# Contrato: cancelamento de pedido

**Feature**: `specs/001-cancelar-pedido` | **Plan**: [../plan.md](../plan.md)

Este contrato descreve o que a feature acrescenta à API. O conteúdo vai para
`docs/api-pedidos.md` no mesmo PR da implementação.

## `POST /pedidos/{id}/cancelamento` (endpoint novo)

Cancela um pedido que ainda não foi enviado.

### Requisição

- Parâmetro de caminho `id`: identificador do pedido (ex.: `PED-1001`).
- Corpo opcional, `Content-Type: application/json`:

```json
{ "motivo": "cliente desistiu" }
```

| Campo    | Tipo   | Novo?   | Regra                                                                  |
|----------|--------|---------|------------------------------------------------------------------------|
| `motivo` | string | **sim** | opcional; até 500 caracteres depois do `trim`; vazio ou só espaços = sem motivo |

### 200 OK: cancelado agora ou já estava cancelado

`Content-Type: application/json`. O corpo é o pedido no mesmo formato de `GET /pedidos/{id}`, com
os campos novos:

```json
{
  "id": "PED-1002",
  "cliente": "Bruno Lima",
  "status": "cancelado",
  "valor_total": 97.4,
  "criadoEm": "2026-09-29T08:40:00Z",
  "forma_pagamento": { "tipo": "cartao", "bandeira": "visa", "parcelas": 2, "final_cartao": "4242" },
  "itens": [
    { "sku": "CX-MED", "quantidade": 1, "preco_unitario": 59.9 },
    { "sku": "FITA-50", "quantidade": 3, "preco_unitario": 12.5 }
  ],
  "canceladoEm": "2026-11-03T14:22:05.123Z",
  "motivoCancelamento": "cliente desistiu"
}
```

- `motivoCancelamento` não aparece quando o cancelamento foi feito sem motivo.
- Se o pedido já estava `cancelado`, a resposta é a mesma da primeira vez. Um `motivo` diferente
  é ignorado, e `canceladoEm` e `motivoCancelamento` não mudam.

### Erros (Problem Details, RFC 9457)

`Content-Type: application/problem+json`. Todos têm `type`, `title`, `status`, `detail` e
`instance` (o caminho da requisição).

**404: pedido não encontrado**

```json
{
  "type": "https://techlog.example/problemas/pedido-nao-encontrado",
  "title": "Pedido não encontrado",
  "status": 404,
  "detail": "Não existe pedido com o id PED-9999.",
  "instance": "/pedidos/PED-9999/cancelamento",
  "pedidoId": "PED-9999"
}
```

**409: pedido já enviado ou entregue**

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

Para `entregue`, o `detail` é "Pedidos já entregues não podem ser cancelados. Status atual:
entregue." e `statusAtual` é `"entregue"`.

**400: motivo acima do limite**

```json
{
  "type": "https://techlog.example/problemas/motivo-muito-longo",
  "title": "Motivo muito longo",
  "status": 400,
  "detail": "O motivo pode ter no máximo 500 caracteres; foram enviados 612.",
  "instance": "/pedidos/PED-1001/cancelamento",
  "limite": 500,
  "tamanho": 612
}
```

**400: requisição inválida** (JSON malformado, corpo que não é JSON, corpo que não é objeto,
`motivo` que não é texto)

```json
{
  "type": "https://techlog.example/problemas/requisicao-invalida",
  "title": "Requisição inválida",
  "status": 400,
  "detail": "O campo motivo, quando informado, deve ser um texto.",
  "instance": "/pedidos/PED-1001/cancelamento"
}
```

Corpo enviado com outro `Content-Type`, como `text/plain` (sem corpo, ou com `Content-Length: 0`,
conta como sem motivo):

```json
{
  "type": "https://techlog.example/problemas/requisicao-invalida",
  "title": "Requisição inválida",
  "status": 400,
  "detail": "O corpo, quando informado, deve ser JSON (Content-Type: application/json).",
  "instance": "/pedidos/PED-1001/cancelamento"
}
```

**413: corpo grande demais** (acima do limite do servidor, 100 KB)

```json
{
  "type": "https://techlog.example/problemas/requisicao-invalida",
  "title": "Requisição inválida",
  "status": 413,
  "detail": "O corpo da requisição é grande demais.",
  "instance": "/pedidos/PED-1005/cancelamento"
}
```

**415: corpo que não pôde ser lido** (charset ou codificação não suportados)

```json
{
  "type": "https://techlog.example/problemas/requisicao-invalida",
  "title": "Requisição inválida",
  "status": 415,
  "detail": "O corpo da requisição não pôde ser lido.",
  "instance": "/pedidos/PED-1005/cancelamento"
}
```

Ordem das verificações: tipo e leitura do corpo (400/413/415) → conteúdo do corpo (400) →
existência (404) → status (200 ou 409).

## Mudanças nos endpoints existentes

| Endpoint            | Mudança                                                                 |
|---------------------|-------------------------------------------------------------------------|
| `GET /pedidos`      | pode listar pedidos `cancelado` com `canceladoEm` e `motivoCancelamento`; `?status=cancelado` filtra |
| `GET /pedidos/{id}` | pode devolver pedido `cancelado` com os campos novos; o erro 404 continua `{ "erro": ... }` |
| `POST /pedidos`     | nenhuma                                                                 |

Pedidos não cancelados continuam idênticos ao formato de hoje, sem `canceladoEm` nem
`motivoCancelamento`.
