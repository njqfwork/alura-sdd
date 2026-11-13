# Quickstart: validar o cancelamento de pedido

Guia para conferir a feature de ponta a ponta. Formatos e regras estão em [data-model.md](./data-model.md) e na proposta de contrato em [contracts/cancelamento.openapi.yaml](./contracts/cancelamento.openapi.yaml). Depois de implementada, a referência passa a ser o `openapi/openapi.yaml`.

## Pré-requisitos

- Node.js >= 24.18 e `npm install` feito.
- `uv` instalado (o portão de conformidade roda o Schemathesis com `uvx`).
- oasdiff instalado (`npm run oasdiff:instalar`) para o portão de breaking change.

## 1. Portões (critério de pronto, Princípio VI)

```sh
npm run portoes
```

Esperado: os cinco portões passam (lint do contrato, breaking change contra a main, tipos gerados, testes de aceite, conformidade). O changelog do contrato (`npm run contrato:changelog`) deve listar apenas a operação nova `cancelarPedido` e as duas propriedades opcionais novas em `Pedido`.

## 2. Só os testes de aceite

```sh
npm run test:aceite
```

Esperado: `pedidos.test.ts` continua passando sem mudança, e `cancelamento.test.ts` cobre os cenários da tabela abaixo.

## 3. Conferência manual

```sh
npm run dev
```

Com a semente padrão (PED-1001 criado, PED-1002 pago, PED-1003 enviado, PED-1004 entregue):

| # | Requisição | Esperado |
|---|---|---|
| 1 | `POST /pedidos/PED-1001/cancelamento` sem corpo | 200; `status: cancelado`, `canceladoEm` preenchido, sem `motivoCancelamento` |
| 2 | `POST /pedidos/PED-1002/cancelamento` com `{"motivo":"  cliente desistiu  "}` | 200; `motivoCancelamento: "cliente desistiu"` |
| 3 | repetir o #2 com `{"motivo":"outro"}` | 200; `canceladoEm` e `motivoCancelamento` iguais aos do #2 |
| 4 | `POST /pedidos/PED-1003/cancelamento` | 409 `application/problem+json`; `statusAtual: enviado`; `detail` explica o motivo; PED-1003 continua `enviado` |
| 5 | `POST /pedidos/PED-1004/cancelamento` | 409; `statusAtual: entregue` |
| 6 | `POST /pedidos/PED-9999/cancelamento` | 404 `pedido-nao-encontrado`, `pedidoId: PED-9999` |
| 7 | motivo com 501 caracteres | 400 `motivo-muito-longo`, `limite: 500`, `tamanho: 501`; pedido não muda |
| 8 | motivo com `"   "` | 200; sem `motivoCancelamento` |
| 9 | corpo `{"motivo":` (JSON malformado) | 400 `requisicao-invalida` em Problem Details |
| 10 | `GET /pedidos` | PED-1001 e PED-1002 aparecem com `status: cancelado` e `canceladoEm` |
| 11 | `GET /pedidos?status=cancelado` / `?status=pago` | o primeiro traz PED-1001 e PED-1002; o segundo não traz PED-1002 |
| 12 | `POST /pedidos` com JSON malformado | mesma resposta de antes da feature (formato de erro legado intacto) |

Exemplo:

```sh
curl -i -X POST http://localhost:3000/pedidos/PED-1003/cancelamento
```

## 4. Cliente web

Abra `http://localhost:3000/`, clique em **Cancelar** num pedido criado ou pago. Esperado: a linha passa a mostrar "cancelado em <data>". O cliente não precisa de mudança.
