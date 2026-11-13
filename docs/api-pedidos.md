# API de Pedidos

Documentação escrita à mão em 2024. Atualize quando mudar a API.

## Endpoints

- `GET /pedidos` lista os pedidos. Aceita `?status=`, inclusive `?status=cancelado`.
- `GET /pedidos/{id}` devolve um pedido.
- `POST /pedidos` cria um pedido.
- `POST /pedidos/{id}/cancelamento` cancela um pedido `criado` ou `pago`. Corpo opcional `{ "motivo": "..." }` (até 500 caracteres).

## Campos do pedido

```json
{
  "id": "PED-1001",
  "cliente": "Ana Souza",
  "status": "pago",
  "total": 79.8,
  "data_criacao": "2026-09-28T10:15:00Z",
  "forma_pagamento": { "tipo": "pix" }
}
```

## Cancelamento

`POST /pedidos/{id}/cancelamento`

Só pedidos com status `criado` ou `pago` podem ser cancelados. O cancelamento só muda o status;
não faz estorno nem mexe no pagamento.

Corpo opcional (`Content-Type: application/json`):

```json
{ "motivo": "cliente desistiu" }
```

- `motivo`: texto opcional, até 500 caracteres depois de tirar os espaços das pontas. Vazio ou só
  com espaços conta como sem motivo.

Resposta `200 OK`: o pedido, no mesmo formato de `GET /pedidos/{id}`, com status `cancelado` e
os campos do cancelamento:

```json
{
  "id": "PED-1002",
  "status": "cancelado",
  "canceladoEm": "2026-11-03T14:22:05.123Z",
  "motivoCancelamento": "cliente desistiu"
}
```

(exemplo resumido; os demais campos do pedido continuam na resposta)

- `canceladoEm` e `motivoCancelamento` só aparecem em pedidos cancelados, e `motivoCancelamento`
  só quando foi informado um motivo. Também aparecem em `GET /pedidos` e `GET /pedidos/{id}`.
- Cancelar de novo um pedido já cancelado responde `200` com o pedido como está; um motivo
  diferente é ignorado e a data e o motivo originais não mudam.

## Erros

Os endpoints `GET /pedidos/{id}` e `POST /pedidos` mantêm o formato de erro atual
(`{ "erro": "mensagem" }` e `{ "message", "code" }`).

O endpoint de cancelamento responde erros em Problem Details (RFC 9457), com
`Content-Type: application/problem+json` e os membros `type`, `title`, `status`, `detail` e
`instance`:

| `type`                                                    | Status | Quando                                         | Extensões                 |
|-----------------------------------------------------------|--------|------------------------------------------------|---------------------------|
| `https://techlog.example/problemas/pedido-nao-encontrado` | 404    | o pedido não existe                            | `pedidoId`                |
| `https://techlog.example/problemas/pedido-nao-cancelavel` | 409    | o pedido já foi `enviado` ou `entregue`        | `pedidoId`, `statusAtual` |
| `https://techlog.example/problemas/motivo-muito-longo`    | 400    | `motivo` com mais de 500 caracteres            | `limite`, `tamanho`       |
| `https://techlog.example/problemas/requisicao-invalida`   | 400    | JSON malformado, corpo que não é JSON, corpo que não é objeto ou `motivo` que não é texto | — |
| `https://techlog.example/problemas/requisicao-invalida`   | 413    | corpo acima do limite aceito pelo servidor      | —                         |
| `https://techlog.example/problemas/requisicao-invalida`   | 415    | charset ou codificação do corpo não suportados  | —                         |

Exemplo:

```json
{
  "type": "https://techlog.example/problemas/pedido-nao-cancelavel",
  "title": "Pedido não pode ser cancelado",
  "status": 409,
  "detail": "Pedidos já enviados não podem ser cancelados. Status atual: enviado.",
  "instance": "/pedidos/PED-1003/cancelamento",
  "pedidoId": "PED-1003",
  "statusAtual": "enviado"
}
```

O corpo é validado antes de o pedido ser procurado: um corpo inválido responde `400` mesmo que o
pedido não exista ou já esteja cancelado.
