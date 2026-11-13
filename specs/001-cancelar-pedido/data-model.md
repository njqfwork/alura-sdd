# Data Model: Cancelar pedido antes do envio

**Feature**: `specs/001-cancelar-pedido` | **Date**: 2026-11-03 | **Plan**: [plan.md](./plan.md)

## Pedido (entidade existente, `src/pedidos/dados.ts`)

### Modelo interno

| Campo                | Tipo                | Novo? | Regra                                                     |
|----------------------|---------------------|-------|-----------------------------------------------------------|
| `id`                 | `string`            | não   | inalterado                                                |
| `cliente`            | `string`            | não   | inalterado                                                |
| `status`             | `Status`            | não   | o tipo ganha o valor `'cancelado'`                        |
| `itens`              | `Item[]`            | não   | inalterado                                                |
| `valorTotal`         | `number`            | não   | inalterado                                                |
| `criadoEm`           | `string` (ISO 8601) | não   | inalterado                                                |
| `formaPagamento`     | `FormaPagamento`    | não   | inalterado; o cancelamento não mexe no pagamento (FR-014) |
| `canceladoEm`        | `string` (ISO 8601) | **sim** | opcional; existe só quando `status === 'cancelado'`     |
| `motivoCancelamento` | `string`            | **sim** | opcional; existe só em pedido cancelado com motivo      |

`Status = 'criado' | 'pago' | 'enviado' | 'entregue' | 'cancelado'`

Invariantes:

- `canceladoEm` existe ⇔ `status === 'cancelado'`.
- `motivoCancelamento` existe ⇒ `status === 'cancelado'`. Quando existe, tem `trim` aplicado, não
  é vazio e tem no máximo 500 caracteres Unicode.
- Depois de gravados, `canceladoEm` e `motivoCancelamento` não mudam mais.

### Representação na API (`src/pedidos/serializar.ts`)

Os campos existentes continuam com os nomes de hoje (`valor_total`, `criadoEm`,
`forma_pagamento`, `preco_unitario` etc.). Os campos novos entram no fim do objeto, só quando
existem:

| Campo na resposta    | Origem                 | Novo?   |
|----------------------|------------------------|---------|
| `canceladoEm`        | `p.canceladoEm`        | **sim** |
| `motivoCancelamento` | `p.motivoCancelamento` | **sim** |

Num pedido não cancelado, a resposta continua idêntica à de hoje (FR-012, SC-005).

## Cancelamento (dados registrados no pedido)

Não é uma entidade separada. São os dois campos opcionais acima, gravados na transição para
`cancelado`.

## Transições de status

```text
criado ──┐
         ├── cancelar ──► cancelado   (grava canceladoEm e, se houver, motivoCancelamento)
pago ────┘

cancelado ── cancelar ──► cancelado   (nada muda; resultado "ja-cancelado")
enviado   ── cancelar ──✕             (recusado; resultado "nao-cancelavel")
entregue  ── cancelar ──✕             (recusado; resultado "nao-cancelavel")
```

Esta feature não tem transição que saia de `cancelado`.

## Operação nova na base: `cancelar(id, motivo?)`

Entrada: `id: string`; `motivo?: string`, já validado e normalizado pela rota (com `trim`;
`undefined` quando não há motivo).

Resultado (união discriminada):

| `resultado`      | Quando                        | Efeito                                             |
|------------------|-------------------------------|----------------------------------------------------|
| `cancelado`      | status `criado` ou `pago`     | muda `status`, grava `canceladoEm` = agora e motivo |
| `ja-cancelado`   | status `cancelado`            | nenhum                                             |
| `nao-cancelavel` | status `enviado` ou `entregue`| nenhum; devolve o pedido para informar `statusAtual`|
| `nao-encontrado` | não existe pedido com o `id`  | nenhum                                             |

`listar(status)` não muda: o filtro já compara `status` com o valor da query, então
`?status=cancelado` funciona assim que existir algum pedido cancelado (FR-011).

## Validação do corpo da requisição (rota)

| Entrada `motivo`                    | Resultado                                     |
|-------------------------------------|-----------------------------------------------|
| ausente, `null`, `""`, só espaços   | sem motivo                                    |
| string com até 500 caracteres após `trim` | motivo = valor com `trim`               |
| string com mais de 500 após `trim`  | 400 `motivo-muito-longo`                      |
| outro tipo (número, objeto, array)  | 400 `requisicao-invalida`                     |
| corpo que não é objeto JSON / JSON malformado | 400 `requisicao-invalida`           |
| sem corpo                           | sem motivo                                    |
