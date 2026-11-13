// Eval de conformidade do agente.
// Roda a mesma tarefa N vezes, cada uma numa cópia limpa, fora do repositório,
// e corrige cada execução com dois corretores separados:
//   forma: os portões do contrato (lint, breaking change, tipos, conformidade)
//   comportamento: os testes de aceite de referência, que só entram na cópia depois que o agente termina
//
// Uso:
//   npm run eval -- --n 3 --contexto eval/contextos/A.md --contexto eval/contextos/B.md
//
// As cópias ficam em ../techlog-eval, ou na pasta de EVAL_PASTA.
// O comando do agente vem de EVAL_AGENTE. O padrão é o Claude Code em modo não interativo.
// Confira os parâmetros do seu agente antes de gravar.

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const valor = (nome, padrao) => {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : padrao;
};
const contextos = args.flatMap((a, i) => (a === '--contexto' ? [args[i + 1]] : []));
const N = Number(valor('--n', '3'));
const BASE = valor('--base', 'v5.2-inicio');
const tarefa = readFileSync('prompts/5.3-tarefa-eval.md', 'utf8');
// Sem --bare: o claude -p usa o login da assinatura e lê o CLAUDE.md, como numa sessão normal.
// O custo que ele devolve (total_cost_usd) é estimativa a preço de lista. Na assinatura,
// o que se gasta é limite do plano, não dinheiro, a menos que os créditos extras estejam ligados.
const agente = process.env.EVAL_AGENTE
  ? process.env.EVAL_AGENTE.split(' ')
  : ['claude', '-p', '--output-format', 'json', '--permission-mode', 'acceptEdits',
     '--allowedTools', 'Bash(npm *),Bash(npx *),Bash(git *)'];

if (!contextos.length) contextos.push('AGENTS.md');
const raiz = resolve('.');
// As cópias ficam ao lado do repositório, não dentro dele: de dentro da cópia,
// o agente não chega ao Git do curso, nem à referencia, nem aos testes que vão corrigi-lo.
const pastaEval = resolve(process.env.EVAL_PASTA ?? join(dirname(raiz), 'techlog-eval'));
mkdirSync(pastaEval, { recursive: true });

// Os portões comparam o contrato com o ponto de partida, não com a main, que já tem o cancelamento.
const ambiente = { ...process.env, CONTRATO_BASE: process.env.CONTRATO_BASE ?? BASE };
const rodar = (cmd, argv, cwd, entrada) =>
  spawnSync(cmd, argv, { cwd, input: entrada, encoding: 'utf8', env: ambiente, maxBuffer: 64 * 1024 * 1024 });

const linhas = [];
for (const contexto of contextos) {
  for (let i = 1; i <= N; i++) {
    const nome = `${contexto.replace(/[^a-zA-Z0-9]/g, '_')}-${i}`;
    const pasta = join(pastaEval, nome);
    if (existsSync(pasta)) rmSync(pasta, { recursive: true, force: true });
    // Cópia isolada: só os arquivos do ponto de partida, com um Git novo de um commit só.
    // Sem histórico, sem as outras branches e sem remoto.
    mkdirSync(pasta, { recursive: true });
    const indice = { ...ambiente, GIT_INDEX_FILE: join(pastaEval, `${nome}.index`) };
    spawnSync('git', ['read-tree', BASE], { cwd: raiz, env: indice });
    spawnSync('git', ['checkout-index', '-a', '-f', `--prefix=${pasta.replace(/\\/g, '/')}/`], { cwd: raiz, env: indice });
    rmSync(indice.GIT_INDEX_FILE, { force: true });
    if (!existsSync(join(pasta, 'openapi', 'openapi.yaml'))) {
      console.error(`Não consegui copiar a tag ${BASE}. Ela existe neste repositório?`);
      process.exit(1);
    }
    rodar('git', ['init', '-q', '-b', 'main'], pasta);
    rodar('git', ['add', '-A'], pasta);
    rodar('git', ['-c', 'user.name=eval', '-c', 'user.email=eval@localhost', 'commit', '-qm', `Ponto de partida (${BASE})`], pasta);
    rodar('git', ['tag', BASE], pasta);
    symlinkSync(join(raiz, 'node_modules'), join(pasta, 'node_modules'), 'junction');
    if (existsSync(join(raiz, 'bin'))) cpSync(join(raiz, 'bin'), join(pasta, 'bin'), { recursive: true });
    cpSync(contexto, join(pasta, 'AGENTS.md'));

    console.log(`\n>>> ${contexto}, execução ${i} de ${N}`);
    const inicio = Date.now();
    // A tarefa vai pela entrada padrão: no claude, --allowedTools aceita vários valores
    // e engoliria a tarefa se ela viesse como último argumento.
    // Sem shell: no Windows o cmd quebraria os parênteses e espaços do --allowedTools.
    const execucao = spawnSync(agente[0], agente.slice(1), { cwd: pasta, input: tarefa, encoding: 'utf8', env: ambiente, maxBuffer: 64 * 1024 * 1024 });
    const agenteRodou = execucao.status === 0;
    if (!agenteRodou) console.log(`O agente terminou com erro: ${(execucao.stderr || execucao.error?.message || '').trim().slice(0, 300)}`);
    let custo = null;
    try {
      custo = JSON.parse(execucao.stdout).total_cost_usd ?? null;
    } catch {}
    const minutos = ((Date.now() - inicio) / 60000).toFixed(1);

    // Forma só conta se o endpoint novo entrou no contrato: uma cópia intocada passaria nos portões.
    const temEndpoint = readFileSync(join(pasta, 'openapi', 'openapi.yaml'), 'utf8').includes('/pedidos/{id}/cancelamento:');
    const forma = agenteRodou && temEndpoint && rodar(process.execPath, ['scripts/portoes.mjs', '--forma'], pasta).status === 0;
    mkdirSync(join(pasta, 'tests', 'referencia'), { recursive: true });
    cpSync(join(raiz, 'eval', 'aceite'), join(pasta, 'tests', 'referencia'), { recursive: true });
    const comportamento =
      rodar(process.execPath, ['--import', 'tsx', '--test', 'tests/referencia/*.test.ts'], pasta).status === 0;

    linhas.push({ contexto, execucao: i, agenteRodou, forma, comportamento, minutos, custo });
    console.log(`forma: ${forma ? 'passou' : 'falhou'} · comportamento: ${comportamento ? 'passou' : 'falhou'}`);
  }
}

console.log('\n=== Placar\n');
for (const contexto of contextos) {
  const daqui = linhas.filter((l) => l.contexto === contexto);
  const f = daqui.filter((l) => l.forma).length;
  const c = daqui.filter((l) => l.comportamento).length;
  const custo = daqui.reduce((t, l) => t + (l.custo ?? 0), 0);
  console.log(`${contexto}`);
  console.log(`  forma:         ${f} de ${daqui.length}`);
  console.log(`  comportamento: ${c} de ${daqui.length}`);
  console.log(`  custo estimado (preço de lista): ${custo ? `US$ ${custo.toFixed(2)}` : 'não informado'}`);
}
mkdirSync('relatorios', { recursive: true });
const arquivo = join('relatorios', `eval-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(arquivo, JSON.stringify(linhas, null, 2));
console.log(`\nDetalhes em ${arquivo}`);
console.log(`Cópias de cada execução em ${pastaEval}`);
