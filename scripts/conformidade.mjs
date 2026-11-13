// Sobe a API numa porta separada, roda o Schemathesis contra ela e derruba no fim.
// Uso:
//   npm run conformidade            só a conformidade das respostas
//   npm run conformidade:completa   dados válidos e inválidos, todas as checagens
// O Schemathesis roda com uvx, que vem com o uv. Não precisa de Docker.
// PYTHONUTF8 evita o UnicodeEncodeError do Windows quando a saída não vai direto para a tela
// (no eval e quando um agente roda os portões).

import { spawn, spawnSync } from 'node:child_process';

const VERSAO = '4.31.0';
// Python fixo: sem Python na máquina, como num Windows novo, o uv baixaria o mais recente,
// e o PyYAML, uma dependência do Schemathesis, ainda não tem pacote pronto para ele.
const PYTHON = '3.12';
const PORTA = process.env.PORTA_CONFORMIDADE ?? '3100';
const url = `http://localhost:${PORTA}`;
const completa = process.argv.includes('--completa');

const opcoes = completa
  ? ['--checks', 'not_a_server_error,status_code_conformance,response_schema_conformance',
     '--mode', 'all', '--max-examples', '30']
  : ['--checks', 'response_schema_conformance', '--mode', 'positive', '--phases', 'examples,coverage'];

const api = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
  env: { ...process.env, PORT: PORTA },
  stdio: 'ignore',
});

async function esperarApi() {
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`${url}/pedidos`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error(`A API não respondeu em ${url}`);
}

let codigo = 1;
try {
  await esperarApi();
  const resultado = spawnSync(
    'uvx',
    ['--python', PYTHON, `schemathesis==${VERSAO}`, 'run', 'openapi/openapi.yaml', '--url', url, '--seed', '42', ...opcoes],
    { stdio: 'inherit', env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' } },
  );
  if (resultado.error) console.error('uvx não encontrado. Instale o uv: https://docs.astral.sh/uv/');
  codigo = resultado.status ?? 1;
} finally {
  api.kill();
}
process.exit(codigo);
