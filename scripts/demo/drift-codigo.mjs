// Demonstração de drift: um nome de campo muda só no código, e o contrato fica igual.
// Muda só o código: a resposta passa a chamar o campo cliente de nomeCliente.
// O contrato não muda, então lint e oasdiff passam. Os testes de aceite
// não olham esse campo, então passam também. Só a conferência do servidor rodando pega.
// Para desfazer: git checkout -- src/pedidos/serializar.ts

import { readFileSync, writeFileSync } from 'node:fs';

const arquivo = 'src/pedidos/serializar.ts';
const antes = readFileSync(arquivo, 'utf8');
const depois = antes.replace('cliente: p.cliente,', 'nomeCliente: p.cliente,');

if (antes === depois) {
  console.log('Nada a mudar: a demonstração já foi aplicada.');
} else {
  writeFileSync(arquivo, depois);
  console.log('No código, cliente virou nomeCliente. O contrato continua igual.');
}
