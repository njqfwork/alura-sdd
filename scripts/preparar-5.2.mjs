// Prepara o ponto de partida do vídeo 5.2: a esteira inteira montada,
// mas sem a feature de cancelamento. O agente refaz a feature com os portões.
// Rode numa branch nova, depois do 5.1:
//   git switch -c aula5-sem-cancelamento
//   git checkout referencia -- scripts/preparar-5.2.mjs
//   npm run preparar:5.2
//   git add -A && git commit -m "Ponto de partida do 5.2"
//   git tag v5.2-inicio

import { readFileSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { parseDocument } from 'yaml';

const trocar = (arquivo, de, para) => {
  const antes = readFileSync(arquivo, 'utf8');
  if (!antes.includes(de)) throw new Error(`Trecho não encontrado em ${arquivo}: ${de.slice(0, 60)}`);
  writeFileSync(arquivo, antes.replace(de, para));
};

// Código
rmSync('src/pedidos/cancelamento.ts', { force: true });
trocar('src/app.ts', "import { rotasCancelamento } from './pedidos/cancelamento.js';\n", '');
trocar('src/app.ts', '  app.use(rotasCancelamento(base));\n', '');
trocar('src/pedidos/dados.ts', '  canceladoEm?: string;\n  motivoCancelamento?: string;\n', '');
trocar('src/pedidos/serializar.ts', '    ...(p.canceladoEm ? { canceladoEm: p.canceladoEm } : {}),\n', '');
trocar('src/pedidos/serializar.ts', '    ...(p.motivoCancelamento ? { motivoCancelamento: p.motivoCancelamento } : {}),\n', '');

// Contrato
// O status cancelado fica no enum. Para o oasdiff, valor novo de enum numa resposta
// é quebra (response-property-enum-value-added): cliente com switch fechado não
// trataria. Com o valor já no contrato, o agente só acrescenta o endpoint e os campos.
const doc = parseDocument(readFileSync('openapi/openapi.yaml', 'utf8'));
doc.deleteIn(['paths', '/pedidos/{id}/cancelamento']);
doc.deleteIn(['components', 'schemas', 'PedidoDeCancelamento']);
doc.deleteIn(['components', 'schemas', 'Problema']);
doc.deleteIn(['components', 'schemas', 'Pedido', 'properties', 'canceladoEm']);
doc.deleteIn(['components', 'schemas', 'Pedido', 'properties', 'motivoCancelamento']);
doc.deleteIn(['components', 'examples', 'PedidoCancelado']);
const tags = doc.getIn(['tags']);
tags.items = tags.items.filter((t) => t.get('name') !== 'cancelamento');
writeFileSync('openapi/openapi.yaml', doc.toString({ flowCollectionPadding: false }));

// Testes e artefatos da feature
rmSync('tests/aceite/cancelamento.test.ts', { force: true });
rmSync('tests/cancelamento.test.ts', { force: true }); // testes do agente na Aula 1, se ficaram
if (existsSync('specs')) {
  for (const pasta of readdirSync('specs')) {
    if (pasta.includes('cancel')) rmSync(`specs/${pasta}`, { recursive: true, force: true });
  }
}

console.log('Cancelamento removido do código, do contrato, dos testes e das specs.');
console.log('A esteira continua: lint, breaking change, tipos, aceite, conformidade e o AGENTS.md.');
console.log('Antes de rodar os portões nesta branch: export CONTRATO_BASE=v5.2-inicio');
