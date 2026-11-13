# Implementation Plan: Cancelar pedido antes do envio

**Branch**: `main` (pasta da feature: `specs/001-cancelar-pedido`) | **Date**: 2026-11-03 |
**Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-cancelar-pedido/spec.md`

## Summary

Permitir cancelar pedidos `criado` ou `pago` por um endpoint **novo**,
`POST /pedidos/{id}/cancelamento`, com motivo opcional de até 500 caracteres. O pedido passa a
`cancelado` e guarda `canceladoEm` e, se houver, `motivoCancelamento` (campos **novos**, em
camelCase). Repetir o cancelamento devolve 200 sem mudar nada. Pedidos `enviado`/`entregue` (409),
inexistentes (404) e motivos inválidos (400) são recusados em Problem Details. A implementação
usa a estrutura que já existe em `src/pedidos`: a regra entra como método `cancelar` da base em
memória, a rota no `Router` de pedidos e os campos novos no serializador, que só os adiciona em
pedidos cancelados. Testes com `node:test` rodando sob `tsx`. Detalhes em [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 em Node.js >= 24.18 (ESM, `module: NodeNext`), executado com `tsx`

**Primary Dependencies**: Express 5.1 (existente). Nenhuma dependência nova.

**Storage**: base em memória de `src/pedidos/dados.ts` (`criarBase()`, uma cópia da semente por instância)

**Testing**: `node:test` + `node:assert/strict`, rodando com `node --import tsx --test`; HTTP com `fetch` nativo sobre `criarApp().listen(0)`

**Target Platform**: servidor Node.js (API HTTP)

**Project Type**: web-service (API REST) com cliente web estático em `cliente/`

**Performance Goals**: não há meta específica; a operação é O(n) sobre a base em memória, como `buscar`

**Constraints**: não quebrar o cliente web nem os formatos de resposta e de erro existentes; contrato `docs/api-pedidos.md` atualizado no mesmo PR; caber num PR

**Scale/Scope**: 1 endpoint novo, 2 campos novos de resposta, 1 status novo; ~4 arquivos de código alterados, 1 de teste novo

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio / Restrição | Como o plano atende | Pré-design | Pós-design |
|---|---|---|---|
| I. Campos em camelCase | Campos novos: `motivo` (requisição), `canceladoEm`, `motivoCancelamento` (resposta), extensões `pedidoId`, `statusAtual`, `limite`, `tamanho`. Campos existentes (`valor_total`, `forma_pagamento`...) mantidos | ✅ | ✅ |
| II. Problem Details em endpoint novo | Todos os erros de `POST /pedidos/{id}/cancelamento`, incluindo JSON malformado (R5), em `application/problem+json`. `GET /pedidos/{id}` mantém `{ "erro" }` e `POST /pedidos` mantém `{ message, code }` | ✅ | ✅ |
| III. Regra nova tem teste | Testes para as transições (criado/pago → cancelado), idempotência, recusas 404/409/400 com o corpo Problem Details, filtro e regressão de pedidos não cancelados | ✅ | ✅ |
| IV. Um PR, sem refatoração misturada | Mudança localizada em `src/pedidos`, `src/app.ts`, testes, `package.json` (script) e `docs/api-pedidos.md`. A divergência antiga do doc não é corrigida aqui (R10) | ✅ | ✅ |
| Restrição: dependências novas justificadas | Nenhuma; `tsx` já é devDependency | ✅ | ✅ |
| Restrição: não quebrar o cliente | Pedidos não cancelados saem idênticos; o cliente só exibe `status` | ✅ | ✅ |
| Restrição: contrato atualizado | `docs/api-pedidos.md` recebe o conteúdo de [contracts/cancelamento.md](./contracts/cancelamento.md) | ✅ | ✅ |
| Fluxo: indicar novo × existente | Marcado em [data-model.md](./data-model.md) e [contracts/cancelamento.md](./contracts/cancelamento.md) | ✅ | ✅ |

Nenhuma violação. Complexity Tracking fica vazio.

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
│   └── cancelamento.md  # Phase 1
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks; ainda não criado)
```

### Source Code (repository root)

```text
src/
├── app.ts                  # ALTERA: monta o handler de erro de JSON malformado em /pedidos/:id/cancelamento
├── server.ts               # sem mudança
└── pedidos/
    ├── dados.ts            # ALTERA: Status + 'cancelado'; Pedido + canceladoEm?, motivoCancelamento?; método cancelar()
    ├── rotas.ts            # ALTERA: POST /pedidos/:id/cancelamento, validação do motivo, helper de Problem Details, handler de erro exportado
    └── serializar.ts       # ALTERA: inclui canceladoEm e motivoCancelamento só quando existem

tests/
└── pedidos/
    └── cancelamento.test.ts  # NOVO: node:test (base + HTTP)

package.json                # ALTERA: script "test"
docs/api-pedidos.md         # ALTERA: endpoint novo, campos novos, filtro cancelado, erros Problem Details
cliente/                    # sem mudança
```

**Structure Decision**: projeto único que já existe. O módulo `src/pedidos` continua com três
arquivos (base, rotas e serializador), como pedido, e os testes ficam numa pasta `tests/` nova na
raiz, que o `tsconfig.json` já inclui.

## Complexity Tracking

Sem violações da constituição.
