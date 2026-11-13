# Implementation Plan: Cancelamento de pedido

**Branch**: `cancelamento-na-esteira` | **Date**: 2026-11-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-cancelar-pedido/spec.md`

## Summary

Adicionar a operação nova `POST /pedidos/{id}/cancelamento`, que leva um pedido `criado` ou `pago` para `cancelado`, registra `canceladoEm` e, se houver, `motivoCancelamento`. Pedido já cancelado responde 200 como está (idempotente). Pedidos `enviado`/`entregue` respondem 409 em Problem Details, com o status atual e a explicação. O schema existente `Pedido` ganha os dois campos opcionais, que passam a aparecer na lista e na consulta. A implementação segue a estrutura que já existe em `src/pedidos`: a regra fica numa função pura, a base em memória ganha `cancelar`, a rota entra no router Express e o serializador inclui os campos novos. O contrato `openapi/openapi.yaml` muda no mesmo PR, e os testes de aceite usam `node:test` com `tsx`.

## Technical Context

**Language/Version**: TypeScript 5.9 sobre Node.js >= 24.18 (ESM, executado com tsx)

**Primary Dependencies**: Express 5 (já no projeto). Nenhuma dependência nova.

**Storage**: base em memória de `src/pedidos/dados.ts` (`criarBase()`), recriada a cada app

**Testing**: `node:test` + `node:assert/strict`, rodando com `tsx --test` pelo script `test:aceite`. Portões completos com `npm run portoes` (Spectral, oasdiff, tipos via openapi-typescript + tsc, aceite, Schemathesis).

**Target Platform**: servidor Node (local e CI do `.github/workflows/contrato.yml`)

**Project Type**: web-service (API REST) com cliente web estático em `cliente/`

**Performance Goals**: nenhum específico; operação O(n) sobre a base em memória, como as que já existem

**Constraints**: não quebrar campos, formatos de erro nem comportamentos que o cliente web já usa; erros legados de `POST /pedidos` e `GET /pedidos/{id}` intactos; contrato e código no mesmo PR

**Scale/Scope**: 1 operação nova, 2 campos novos opcionais em 1 schema existente, cerca de 5 arquivos de código e 1 arquivo de teste novo

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Como o plano atende | Situação |
|---|---|---|
| I. Campos novos em camelCase | Campos novos: `motivo` (entrada), `canceladoEm`, `motivoCancelamento` (Pedido), extensões `pedidoId`, `statusAtual`, `limite`, `tamanho`. Nenhum campo existente renomeado ou depreciado. | ✅ |
| II. Problem Details em endpoint novo | Todas as respostas 4xx de `cancelarPedido` em `application/problem+json`, inclusive erros de parse do corpo (R4). Endpoints legados mantêm o formato atual: o tratador de erro só vale para o caminho novo. | ✅ |
| III. Regra nova com teste | Transições (criado/pago → cancelado, recancelamento idempotente, recusa de enviado/entregue), limite do motivo e formato dos erros cobertos em `tests/aceite/cancelamento.test.ts`. | ✅ |
| IV. Um PR pequeno | Contrato + 5 arquivos de `src` + 1 teste. Sem refatoração alheia; `docs/api-pedidos.md` não é mexido. A mudança em `responderProblema` (parâmetro opcional de extensões) é necessária para a feature. | ✅ |
| V. OpenAPI como fonte de verdade | `contracts/` é proposta; a mudança entra em `openapi/openapi.yaml` no mesmo PR; tipos regenerados em `src/gerado/api.d.ts`. | ✅ |
| VI. Pronto com `npm run portoes` | Critério de pronto do quickstart, passo 1. Nenhum portão será afrouxado. | ✅ |
| Novo × existente indicado | Ver tabela em [data-model.md](./data-model.md). | ✅ |

**Re-check pós-design**: mantido. O design não introduziu violação: campo novo opcional na resposta não é breaking change para o oasdiff, a operação sem `x-legado` atende às regras do Spectral, e cada status que a rota devolve está documentado para o Schemathesis (R9).

## Project Structure

### Documentation (this feature)

```text
specs/001-cancelar-pedido/
├── spec.md
├── plan.md              # este arquivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── cancelamento.openapi.yaml   # proposta; vale quando entrar no openapi/openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
openapi/
└── openapi.yaml              # MUDA: operação cancelarPedido, Pedido + 2 campos, schemas Problema*

src/
├── app.ts                    # sem mudança (express.json() global continua)
├── problemas.ts              # MUDA: responderProblema aceita extensões opcionais
├── gerado/
│   └── api.d.ts              # REGERADO por npm run gerar:tipos
└── pedidos/
    ├── dados.ts              # MUDA: Pedido ganha canceladoEm?/motivoCancelamento?; base ganha cancelar()
    ├── cancelamento.ts       # NOVO: regra pura da transição e validação do motivo
    ├── rotas.ts              # MUDA: POST /pedidos/:id/cancelamento + tratador de erro de parse só nesse caminho
    └── serializar.ts         # MUDA: emite canceladoEm/motivoCancelamento quando existem

tests/
└── aceite/
    ├── pedidos.test.ts       # sem mudança
    └── cancelamento.test.ts  # NOVO
```

**Structure Decision**: projeto único, a estrutura que já existe em `src/pedidos` (router Express, base em memória, serializador tipado pelo contrato). Só entra um módulo novo, `cancelamento.ts`, para isolar a regra de negócio (research R1). O cliente `cliente/` já chama este endpoint e lê `canceladoEm` e `detail`, então não muda.

## Complexity Tracking

Nenhuma violação da constituição a justificar.
