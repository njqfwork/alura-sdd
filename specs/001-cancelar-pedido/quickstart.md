# Quickstart: validar o cancelamento de pedido

**Feature**: `specs/001-cancelar-pedido` | **Plan**: [plan.md](./plan.md) |
**Contrato**: [contracts/cancelamento.md](./contracts/cancelamento.md) |
**Modelo**: [data-model.md](./data-model.md)

## Pré-requisitos

- Node.js >= 24.18 (`npm run conferir` confere o ambiente).
- Dependências instaladas: `npm install`.

## Testes automatizados

```bash
npm test
```

Esperado: todos os testes de `tests/pedidos/cancelamento.test.ts` passam. Eles cobrem os cenários
abaixo, os casos de erro com o corpo Problem Details e a regressão dos pedidos não cancelados.

## Validação manual

Suba a API com `npm start` (porta 3000). A base em memória volta à semente a cada reinício, com
PED-1001 `criado`, PED-1002 `pago`, PED-1003 `enviado`, PED-1004 `entregue` e PED-1005 `pago`.

| # | Requisição | Esperado | Cobre |
|---|------------|----------|-------|
| 1 | `curl -i -X POST localhost:3000/pedidos/PED-1001/cancelamento` | 200, `status: "cancelado"`, `canceladoEm` presente, sem `motivoCancelamento` | US1-1 |
| 2 | `curl -i -X POST localhost:3000/pedidos/PED-1002/cancelamento -H "Content-Type: application/json" -d '{"motivo":"cliente desistiu"}'` | 200, `motivoCancelamento: "cliente desistiu"` | US1-2 |
| 3 | `curl -i localhost:3000/pedidos/PED-1002` | 200, `cancelado`, mesmo `canceladoEm` e motivo de #2 | US1-3 |
| 4 | repetir #2 com `{"motivo":"outro"}` | 200, corpo idêntico ao de #2 | US1-4, FR-006 |
| 5 | `curl -i -X POST localhost:3000/pedidos/PED-1003/cancelamento` | 409 `application/problem+json`, `type` `.../pedido-nao-cancelavel`, `statusAtual: "enviado"`; `GET` mostra PED-1003 ainda `enviado` | US2-1 |
| 6 | `curl -i -X POST localhost:3000/pedidos/PED-1004/cancelamento` | 409, `statusAtual: "entregue"`, `detail` fala em "entregues" | US2-2 |
| 7 | `curl -i -X POST localhost:3000/pedidos/PED-9999/cancelamento` | 404 `application/problem+json`, `type` `.../pedido-nao-encontrado` | US2-3 |
| 8 | `POST` em PED-1005 com motivo de 501 caracteres | 400, `type` `.../motivo-muito-longo`, `limite: 500`; PED-1005 continua `pago` | FR-008 |
| 9 | `POST` em PED-1005 com `-d '{"motivo":'` (JSON malformado) | 400 `application/problem+json`, `type` `.../requisicao-invalida` | Princípio II |
| 10 | `POST` em PED-1005 com `{"motivo":"   "}` | 200, sem `motivoCancelamento` | edge case |
| 11 | `curl -s "localhost:3000/pedidos?status=cancelado"` | só pedidos cancelados | US3-2 |
| 12 | `curl -s localhost:3000/pedidos` | cancelados com `canceladoEm`; os demais sem os campos novos | US3-1, US3-3 |
| 13 | `curl -i localhost:3000/pedidos/PED-9999` | 404 com `{ "erro": "Pedido não encontrado" }`, igual a hoje | regressão |
| 14 | `POST` em PED-1005 com corpo JSON acima de 100 KB (comando abaixo) | 413 `application/problem+json`, `type` `.../requisicao-invalida`, `detail` "O corpo da requisição é grande demais." | Princípio II |
| 15 | `curl -i -X POST localhost:3000/pedidos/PED-1005/cancelamento -H "Content-Type: application/json; charset=latin9" -d '{}'` | 415 `application/problem+json`, `detail` "O corpo da requisição não pôde ser lido." | Princípio II |
| 16 | `curl -i -X POST localhost:3000/pedidos/PED-1001/cancelamento -H "Content-Type: text/plain" -d 'cliente desistiu'` | 400 `application/problem+json`, `detail` "O corpo, quando informado, deve ser JSON (Content-Type: application/json)."; o pedido não muda (logo depois de reiniciar a API, PED-1001 continua `criado`) | data-model |

Para gerar o motivo de 501 caracteres do #8:

```bash
curl -i -X POST localhost:3000/pedidos/PED-1005/cancelamento -H "Content-Type: application/json" \
  -d "{\"motivo\":\"$(printf 'a%.0s' $(seq 1 501))\"}"
```

Para gerar o corpo acima de 100 KB do #14:

```bash
node -e 'process.stdout.write(JSON.stringify({ motivo: "a".repeat(200000) }))' > corpo-grande.json
curl -i -X POST localhost:3000/pedidos/PED-1005/cancelamento -H "Content-Type: application/json" \
  --data-binary @corpo-grande.json
```

## Cliente web

Abra `http://localhost:3000/` depois de cancelar algum pedido. A tabela mostra o selo `cancelado`
nesse pedido, e os demais aparecem como antes (SC-005).
