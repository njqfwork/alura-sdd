# Data Model: Cancelamento de pedido

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Para cada campo, a coluna "Novo?" mostra quais princípios da constituição se aplicam: campo novo segue o Princípio I (camelCase), campo existente não muda.

## Pedido (entidade existente)

Interno: `Pedido` em `src/pedidos/dados.ts`. Na resposta: schema `Pedido` do `openapi/openapi.yaml`, montado por `src/pedidos/serializar.ts`.

| Campo interno | Campo na resposta | Tipo | Novo? | Regra |
|---|---|---|---|---|
| `id` | `id` | string `PED-n` | existente | sem mudança |
| `status` | `status` | `StatusPedido` | existente | passa a ir para `cancelado` pela operação nova |
| `canceladoEm` | `canceladoEm` | date-time ISO 8601 (UTC) | **novo** | só existe em pedido cancelado por esta feature; definido uma vez e não muda mais |
| `motivoCancelamento` | `motivoCancelamento` | string, 1 a 500 caracteres | **novo** | só existe se o cancelamento teve motivo (já aparado); definido uma vez e não muda mais |
| demais (`cliente`, `itens`, `valorTotal`, `criadoEm`, `formaPagamento`) | `cliente`, `itens`, `valor_total`/`valorTotal`, `criadoEm`, `forma_pagamento` | — | existentes | sem mudança (FR-012) |

Os dois campos novos são opcionais. Em pedido não cancelado eles não aparecem na resposta, em vez de virem como `null`. Pedidos que já estavam cancelados na semente (hoje não há nenhum) também ficariam sem `canceladoEm`.

## StatusPedido (enum existente)

`criado | pago | enviado | entregue | cancelado`, sem valor novo.

### Transições da operação de cancelamento

| Status de origem | Resultado | Efeito | Resposta |
|---|---|---|---|
| `criado` | cancelado | `status = cancelado`, `canceladoEm = agora`, `motivoCancelamento = motivo` (se houver) | 200 + pedido |
| `pago` | cancelado | igual ao anterior; sem estorno | 200 + pedido |
| `cancelado` | já cancelado | nenhum; o motivo novo é ignorado | 200 + pedido como está |
| `enviado` | não cancelável | nenhum | 409 `pedido-nao-cancelavel`, `statusAtual: enviado` |
| `entregue` | não cancelável | nenhum | 409 `pedido-nao-cancelavel`, `statusAtual: entregue` |
| (id inexistente) | não encontrado | nenhum | 404 `pedido-nao-encontrado` |

Não há transição que saia de `cancelado`.

## Pedido de cancelamento (entrada nova)

Corpo opcional de `POST /pedidos/{id}/cancelamento` (operação **nova**).

| Campo | Tipo | Novo? | Regra |
|---|---|---|---|
| `motivo` | string | **novo** | opcional; aparado; vazio depois de aparado = sem motivo; mais de 500 caracteres depois de aparado → 400 `motivo-muito-longo` (`limite: 500`, `tamanho: n`); se não for texto → 400 `requisicao-invalida` |

Ordem de validação: primeiro o corpo, depois a existência do pedido, depois a transição.

## Problem Details da operação nova

Os membros padrão (`type`, `title`, `status`, `detail`, `instance`) são da RFC 9457. As extensões são **novas** e em camelCase.

| Tipo | Status | Extensões |
|---|---|---|
| `pedido-nao-encontrado` | 404 | `pedidoId` |
| `pedido-nao-cancelavel` | 409 | `pedidoId`, `statusAtual` |
| `motivo-muito-longo` | 400 | `limite`, `tamanho` |
| `requisicao-invalida` | 400, 413, 415 | — |
