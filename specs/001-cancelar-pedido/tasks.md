---

description: "Task list for feature implementation"
---

# Tasks: Cancelamento de pedido

**Input**: Design documents from `specs/001-cancelar-pedido/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/cancelamento.openapi.yaml](./contracts/cancelamento.openapi.yaml), [quickstart.md](./quickstart.md)

**Tests**: obrigatórios. O Princípio III da constituição exige teste automatizado para toda regra de negócio nova e para os casos de erro, inclusive o corpo Problem Details. Os testes de cada história são escritos antes da implementação e precisam falhar até ela existir.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Projeto único: `src/`, `tests/` e `openapi/` na raiz do repositório.

## Convenções que valem para todas as tarefas

- Campos e membros de extensão novos em camelCase (Princípio I). Nenhum campo existente muda.
- Toda resposta 4xx de `POST /pedidos/{id}/cancelamento` é `application/problem+json`, via `responderProblema` de `src/problemas.ts` (Princípio II). Os erros de `GET /pedidos/{id}` e `POST /pedidos` continuam como estão.
- Base da URL dos tipos: `https://api.techlog.example/problemas/{tipo}` (a que `responderProblema` já monta). `instance` é `/pedidos/{id}/cancelamento`.
- Textos fixos dos problemas (usar exatamente estes):

| Tipo | Status | `title` | `detail` |
|---|---|---|---|
| `pedido-nao-encontrado` | 404 | `Pedido não encontrado` | `Não existe pedido com o id {id}.` |
| `pedido-nao-cancelavel` | 409 | `Pedido não pode ser cancelado` | `Pedidos já enviados não podem ser cancelados. Status atual: enviado.` ou `Pedidos já entregues não podem ser cancelados. Status atual: entregue.` |
| `motivo-muito-longo` | 400 | `Motivo muito longo` | `O motivo pode ter até 500 caracteres; foram enviados {tamanho}.` |
| `requisicao-invalida` | 400 | `Requisição inválida` | `O corpo não é um JSON válido.` / `O corpo precisa ser um objeto JSON.` / `O campo motivo precisa ser texto.` / `O corpo precisa ser JSON (Content-Type: application/json).` |
| `requisicao-invalida` | 413 | `Requisição inválida` | `O corpo passa do limite aceito.` |
| `requisicao-invalida` | 415 | `Requisição inválida` | `Charset ou codificação do corpo não suportados.` |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: confirmar que o ponto de partida está verde, para que qualquer falha depois seja da feature

- [ ] T001 Rodar `npm run portoes` na raiz e confirmar que os cinco portões passam antes de qualquer mudança (se o oasdiff faltar, `npm run oasdiff:instalar`; se o `uv` faltar, instalar antes). Não alterar `scripts/portoes.mjs`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: contrato, tipos e modelo que todas as histórias usam

**⚠️ CRITICAL**: nenhuma história começa antes desta fase

- [ ] T002 Em `openapi/openapi.yaml`, no schema EXISTENTE `components.schemas.Pedido`, adicionar duas propriedades opcionais sem mexer em `required` nem nas outras: `canceladoEm` (`type: string`, `format: date-time`, descrição "Data e hora do cancelamento. Só aparece em pedido cancelado.") e `motivoCancelamento` (`type: string`, `minLength: 1`, `maxLength: 500`, descrição "Motivo informado no cancelamento. Só aparece quando houve motivo."), conforme `specs/001-cancelar-pedido/contracts/cancelamento.openapi.yaml`
- [ ] T003 Em `openapi/openapi.yaml`, adicionar em `components.schemas` os schemas NOVOS `PedidoCancelamento` (objeto com `motivo`: `type: string`, `maxLength: 500`), `Problema` (`required: [type, title, status]`; `type` uri, `title`, `status` integer, `detail`, `instance`), `ProblemaPedido` (Problema + `pedidoId` obrigatório), `ProblemaPedidoNaoCancelavel` (ProblemaPedido + `statusAtual` obrigatório, `$ref` StatusPedido) e `ProblemaMotivoMuitoLongo` (Problema + `limite` e `tamanho` inteiros obrigatórios), copiando de `specs/001-cancelar-pedido/contracts/cancelamento.openapi.yaml`
- [ ] T004 Em `openapi/openapi.yaml`, adicionar o caminho NOVO `/pedidos/{id}/cancelamento` com `post` `operationId: cancelarPedido`, `tags: [pedidos]`, SEM `x-legado`, `requestBody.required: false` (schema `PedidoCancelamento`), respostas `200` (`application/json`, `Pedido`, exemplo `PedidoCancelado`), `400` (`application/problem+json`, `anyOf` ProblemaMotivoMuitoLongo/Problema), `404` (ProblemaPedido), `409` (ProblemaPedidoNaoCancelavel), `413` e `415` (Problema), com os exemplos da proposta; adicionar `components.examples.PedidoCancelado`. Usar a base `https://api.techlog.example/problemas/` nos exemplos. Rodar `npm run contrato:lint` e corrigir até passar sem erro
- [ ] T005 Rodar `npm run gerar:tipos` para regenerar `src/gerado/api.d.ts` a partir do contrato (não editar esse arquivo à mão)
- [ ] T006 [P] Em `src/pedidos/dados.ts`, adicionar à interface `Pedido` os campos opcionais `canceladoEm?: string` e `motivoCancelamento?: string`, com comentário curto de que só existem em pedido cancelado
- [ ] T007 [P] Em `src/problemas.ts`, adicionar a `responderProblema` um último parâmetro opcional `extensoes: Record<string, unknown> = {}`, espalhado no corpo depois dos membros padrão, sem mudar o comportamento das chamadas atuais
- [ ] T008 Em `src/pedidos/serializar.ts`, em `serializarPedido`, incluir `canceladoEm` e `motivoCancelamento` no objeto devolvido só quando estiverem definidos no pedido (nunca como `null` nem `undefined` explícito), mantendo os demais campos e a ordem atuais; rodar `npm run tipos` e confirmar que compila (depende de T005 e T006)
- [ ] T009 Criar `tests/aceite/cancelamento.test.ts` com `node:test` e `node:assert/strict`, no estilo de `tests/aceite/pedidos.test.ts`, com um helper que sobe um app novo por teste (`criarApp().listen(0)`, espera `listening`, devolve a URL base e fecha o servidor no fim do teste) e um helper `cancelar(api, id, corpo?, headers?)` que faz `POST /pedidos/{id}/cancelamento`. Sem testes de comportamento ainda

**Checkpoint**: `npm run tipos` e `npm run test:aceite` passam; o contrato descreve a operação nova

---

## Phase 3: User Story 1 - Cancelar um pedido que ainda não foi enviado (Priority: P1) 🎯 MVP

**Goal**: quem opera a loja cancela um pedido `criado` ou `pago`, com motivo opcional, e recebe o pedido com `status: cancelado` e `canceladoEm`

**Independent Test**: cancelar PED-1001 (criado) sem corpo e PED-1002 (pago) com motivo; os dois voltam 200 com `status: cancelado` e `canceladoEm`, e `GET /pedidos/{id}` mostra o mesmo

### Tests for User Story 1 ⚠️

> Escrever estes testes primeiro, em `tests/aceite/cancelamento.test.ts`, e confirmar que falham antes da implementação

- [ ] T010 [US1] Teste: `POST /pedidos/PED-1001/cancelamento` sem corpo → 200, `content-type` JSON, `status: 'cancelado'`, `canceladoEm` é data ISO válida e não anterior ao início do teste, sem a chave `motivoCancelamento`; `GET /pedidos/PED-1001` devolve o mesmo `status` e `canceladoEm`. Também: corpo `{}` com `Content-Type: application/json` em PED-1002 → 200 sem `motivoCancelamento`
- [ ] T011 [US1] Teste: `POST /pedidos/PED-1002/cancelamento` (pago) com `{"motivo":"  cliente desistiu  "}` → 200, `motivoCancelamento: 'cliente desistiu'` (aparado); `{"motivo":"   "}` em PED-1001 → 200 sem `motivoCancelamento`; motivo com exatamente 500 caracteres → 200 com o motivo inteiro
- [ ] T012 [US1] Teste do recancelamento idempotente: cancelar PED-1002 com `{"motivo":"cliente desistiu"}`, depois cancelar de novo com `{"motivo":"outro"}` → 200, `status: 'cancelado'`, `canceladoEm` e `motivoCancelamento` iguais aos da primeira resposta. Também: duas requisições disparadas juntas (`Promise.all`) para PED-1001 com motivos diferentes → as duas 200 com o mesmo `canceladoEm` e o mesmo `motivoCancelamento`
- [ ] T013 [US1] Testes de validação do corpo (todos `application/problem+json`, com `type`, `title`, `status`, `detail`, `instance: '/pedidos/{id}/cancelamento'` e os textos da tabela de convenções): motivo com 501 caracteres depois de aparar → 400 `motivo-muito-longo` com `limite: 500` e `tamanho: 501`, e `GET` mostra PED-1001 ainda `criado`; `{"motivo": 123}` → 400 `requisicao-invalida`; corpo `[]` → 400 `requisicao-invalida`; corpo `{"motivo":` com `Content-Type: application/json` → 400 `requisicao-invalida`; corpo `motivo=x` com `Content-Type: text/plain` → 400 `requisicao-invalida`; motivo com 501 caracteres para `PED-9999` → 400 (o corpo é validado antes de procurar o pedido)
- [ ] T014 [US1] Teste de não regressão: `POST /pedidos` com corpo `{"cliente":` e `Content-Type: application/json` devolve o mesmo status de antes da feature e um `content-type` que NÃO é `application/problem+json` (o tratador novo vale só para o caminho do cancelamento)

### Implementation for User Story 1

- [ ] T015 [P] [US1] Criar `src/pedidos/cancelamento.ts` com duas funções puras, com comentário curto no topo como nos outros arquivos: `lerMotivo(corpo: unknown)` → `{ ok: true; motivo?: string } | { ok: false; erro: 'requisicao-invalida'; detalhe: string } | { ok: false; erro: 'motivo-muito-longo'; tamanho: number }`, onde `undefined` (sem corpo) e objeto sem `motivo` = sem motivo; não objeto ou array = `requisicao-invalida` ("O corpo precisa ser um objeto JSON."); `motivo` que não é string = `requisicao-invalida` ("O campo motivo precisa ser texto."); a string é aparada (`trim`); vazia depois de aparar = sem motivo; "até 500 caracteres depois de tirar os espaços das pontas", acima disso = `motivo-muito-longo` com o tamanho aparado. E `decidirCancelamento(status: Status)` → `'cancelar'` para `criado` e `pago`, `'jaCancelado'` para `cancelado`, `'naoCancelavel'` para `enviado` e `entregue`. Exportar a constante `LIMITE_MOTIVO = 500`
- [ ] T016 [US1] Em `src/pedidos/dados.ts`, adicionar a `criarBase()` o método `cancelar(id: string, motivo: string | undefined, agora = new Date())`, síncrono, que devolve `{ resultado: 'naoEncontrado' }` se o pedido não existe; senão aplica `decidirCancelamento(pedido.status)`: em `'cancelar'` grava `status = 'cancelado'`, `canceladoEm = agora.toISOString()` e, se houver, `motivoCancelamento = motivo`, e devolve `{ resultado: 'cancelado', pedido }`; em `'jaCancelado'` não muda nada e devolve `{ resultado: 'jaCancelado', pedido }`; em `'naoCancelavel'` não muda nada e devolve `{ resultado: 'naoCancelavel', pedido }` (depende de T015)
- [ ] T017 [US1] Em `src/pedidos/rotas.ts`, adicionar `rotas.post('/pedidos/:id/cancelamento', ...)`: se a requisição tem corpo (`content-length` > 0 ou `transfer-encoding` presente) e `!req.is('application/json')` → 400 `requisicao-invalida` ("O corpo precisa ser JSON (Content-Type: application/json)."); senão `lerMotivo(req.body)` e, em erro, 400 com o problema correspondente (`motivo-muito-longo` com extensões `limite: LIMITE_MOTIVO` e `tamanho`); só depois `base.cancelar(id, motivo)`: `cancelado`/`jaCancelado` → 200 `serializarPedido(pedido)`; `naoEncontrado` → 404 `pedido-nao-encontrado` com extensão `pedidoId`; `naoCancelavel` → 409 `pedido-nao-cancelavel` com extensões `pedidoId` e `statusAtual` e o `detail` da tabela de convenções conforme o status. Usar `responderProblema` com os textos da tabela (depende de T007, T008, T016)
- [ ] T018 [US1] Em `src/pedidos/rotas.ts`, adicionar um middleware de erro só para o caminho, `rotas.use('/pedidos/:id/cancelamento', (erro, req, res, next) => ...)`, depois da rota: `erro.type === 'entity.parse.failed'` → 400 `requisicao-invalida` ("O corpo não é um JSON válido."); `'entity.too.large'` → 413; `'charset.unsupported'` ou `'encoding.unsupported'` → 415; qualquer outro erro → `next(erro)`. Não registrar tratador global nem mexer em `src/app.ts`
- [ ] T019 [US1] Rodar `npm run test:aceite` e confirmar que T010–T014 passam e que `tests/aceite/pedidos.test.ts` continua passando sem mudança

**Checkpoint**: US1 funciona sozinha; pedido criado ou pago pode ser cancelado pela API e pelo botão do `cliente/`

---

## Phase 4: User Story 2 - Entender por que um pedido não pode ser cancelado (Priority: P2)

**Goal**: tentativa de cancelar pedido enviado, entregue ou inexistente é recusada sem mudar nada, e a resposta explica por quê e qual é o status atual

**Independent Test**: cancelar PED-1003 (enviado) e PED-1004 (entregue) devolve 409 com `statusAtual` e `detail` explicativo, e os pedidos continuam como estavam; `PED-9999` devolve 404

### Tests for User Story 2 ⚠️

- [ ] T020 [US2] Em `tests/aceite/cancelamento.test.ts`, teste: `POST /pedidos/PED-1003/cancelamento` com `{"motivo":"teste"}` → 409, `content-type` `application/problem+json`, corpo igual (`deepEqual`) a `{ type: 'https://api.techlog.example/problemas/pedido-nao-cancelavel', title: 'Pedido não pode ser cancelado', status: 409, detail: 'Pedidos já enviados não podem ser cancelados. Status atual: enviado.', instance: '/pedidos/PED-1003/cancelamento', pedidoId: 'PED-1003', statusAtual: 'enviado' }`; `GET /pedidos/PED-1003` continua `status: 'enviado'`, sem `canceladoEm` nem `motivoCancelamento`
- [ ] T021 [US2] Em `tests/aceite/cancelamento.test.ts`, teste equivalente para PED-1004: 409 com `detail: 'Pedidos já entregues não podem ser cancelados. Status atual: entregue.'` e `statusAtual: 'entregue'`; o pedido continua `entregue`
- [ ] T022 [US2] Em `tests/aceite/cancelamento.test.ts`, teste: `POST /pedidos/PED-9999/cancelamento` sem corpo → 404 `application/problem+json`, `type` terminando em `/pedido-nao-encontrado`, `title: 'Pedido não encontrado'`, `detail: 'Não existe pedido com o id PED-9999.'`, `pedidoId: 'PED-9999'`; e `GET /pedidos/PED-9999` continua devolvendo `{ erro: 'Pedido não encontrado' }` (formato legado intacto)

### Implementation for User Story 2

- [ ] T023 [US2] Rodar `npm run test:aceite`; se T020–T022 falharem, corrigir o ramo `naoCancelavel`/`naoEncontrado` da rota em `src/pedidos/rotas.ts` (T017) até os corpos baterem exatamente, sem mudar os testes

**Checkpoint**: US1 e US2 funcionam; nenhuma recusa altera o pedido

---

## Phase 5: User Story 3 - Ver pedidos cancelados na lista (Priority: P3)

**Goal**: pedidos cancelados continuam na lista e na consulta, com `status: cancelado` e `canceladoEm`, e o filtro por status os encontra

**Independent Test**: depois de cancelar um pedido, `GET /pedidos` e `GET /pedidos?status=cancelado` o mostram com `canceladoEm`; `?status=pago` não o mostra mais

### Tests for User Story 3 ⚠️

- [ ] T024 [US3] Em `tests/aceite/cancelamento.test.ts`, teste: cancelar PED-1002 com motivo; `GET /pedidos` continua com 5 pedidos, e o PED-1002 aparece com `status: 'cancelado'`, `canceladoEm` e `motivoCancelamento`; `GET /pedidos?status=cancelado` devolve só o PED-1002; `GET /pedidos?status=pago` devolve só o PED-1005
- [ ] T025 [US3] Em `tests/aceite/cancelamento.test.ts`, teste de não regressão: num app novo, sem cancelar nada, nenhum pedido de `GET /pedidos` tem as chaves `canceladoEm` ou `motivoCancelamento`, e `GET /pedidos/PED-1001` tem exatamente as chaves de antes (`id`, `cliente`, `status`, `valor_total`, `valorTotal`, `criadoEm`, `forma_pagamento`, `itens`)

### Implementation for User Story 3

- [ ] T026 [US3] Rodar `npm run test:aceite`; se T024–T025 falharem, corrigir `serializarPedido` em `src/pedidos/serializar.ts` (T008) ou `listar` em `src/pedidos/dados.ts`, sem mudar o comportamento atual do filtro para os outros status

**Checkpoint**: as três histórias funcionam de forma independente

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: portões e validação final (Princípios V e VI)

- [ ] T027 Rodar `npm run contrato:changelog` e confirmar que lista só a operação nova `cancelarPedido` e as propriedades opcionais novas de `Pedido`, sem mudança em operação existente
- [ ] T028 Rodar `npm run conformidade`; se o Schemathesis apontar resposta fora do schema em `/pedidos/{id}/cancelamento`, corrigir o código ou o contrato na causa (os dois precisam bater), sem afrouxar o portão
- [ ] T029 Seguir a conferência manual de `specs/001-cancelar-pedido/quickstart.md` (seções 3 e 4), incluindo o botão Cancelar de `cliente/index.html` mostrando "cancelado em <data>"
- [ ] T030 Rodar `npm run portoes` e confirmar o placar "Todos os portões passaram." Sem isso a feature não está pronta. Conferir que o diff toca só `openapi/openapi.yaml`, `src/gerado/api.d.ts`, `src/problemas.ts`, `src/pedidos/*.ts`, `tests/aceite/cancelamento.test.ts` e `specs/001-cancelar-pedido/` (`docs/api-pedidos.md` e `cliente/` sem mudança)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências
- **Foundational (Phase 2)**: depende do Setup e bloqueia todas as histórias. Ordem: T002 → T003 → T004 → T005 (mesmo arquivo, depois a geração dos tipos); T006 e T007 em paralelo com T002–T005; T008 depois de T005 e T006; T009 a qualquer momento da fase
- **US1 (Phase 3)**: depende da Foundational. Ela entrega a rota inteira, inclusive os ramos de recusa, para que nenhum pedido enviado ou entregue seja cancelado em estado intermediário
- **US2 (Phase 4)**: depende de US1 (verifica e ajusta os ramos de recusa da rota de T017)
- **US3 (Phase 5)**: depende da Foundational (serializador) e de US1 (para existir pedido cancelado). Independente de US2
- **Polish (Phase 6)**: depende de todas as histórias

### Within Each User Story

- Testes primeiro, falhando; depois a implementação
- `cancelamento.ts` (T015) → `dados.ts` (T016) → `rotas.ts` (T017 → T018)
- Todos os testes estão no mesmo arquivo, então são sequenciais entre si

### Parallel Opportunities

- T006 (`dados.ts`) e T007 (`problemas.ts`) em paralelo com as tarefas de contrato T002–T004
- T015 (`cancelamento.ts`) em paralelo com os testes T010–T014 (arquivos diferentes)
- US2 (T020–T023) e US3 (T024–T026) podem andar em paralelo depois de US1, se feitas por pessoas diferentes; como os testes estão no mesmo arquivo, combinar a ordem dos commits

---

## Parallel Example: User Story 1

```text
# Em paralelo, depois da Foundational:
Tarefa: "T010–T014 testes de US1 em tests/aceite/cancelamento.test.ts"
Tarefa: "T015 regras puras em src/pedidos/cancelamento.ts"

# Depois, em sequência:
Tarefa: "T016 base.cancelar em src/pedidos/dados.ts"
Tarefa: "T017–T018 rota e tratador de parse em src/pedidos/rotas.ts"
```

## Parallel Example: Foundational

```text
Tarefa: "T002–T004 contrato em openapi/openapi.yaml"
Tarefa: "T006 campos opcionais em src/pedidos/dados.ts"
Tarefa: "T007 extensões em src/problemas.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (T001) e Phase 2 (T002–T009)
2. Phase 3 (T010–T019)
3. **Parar e validar**: `npm run test:aceite` e o botão do cliente
4. Mesmo no MVP, a feature só está pronta com `npm run portoes` passando (T030)

### Incremental Delivery

1. Foundational → contrato e tipos prontos
2. US1 → cancelamento funcionando (MVP)
3. US2 → recusas verificadas com mensagens exatas
4. US3 → lista e filtro verificados
5. Polish → portões verdes

Tudo cabe num único PR (Princípio IV): contrato, código e testes juntos (Princípio V).

---

## Notes

- [P] = arquivos diferentes, sem dependência de tarefa incompleta
- Não editar `src/gerado/api.d.ts` à mão; regenerar com `npm run gerar:tipos`
- Não desligar nem enfraquecer portão (Princípio VI); falha se corrige na causa
- Não alterar `docs/api-pedidos.md`, `cliente/` nem o formato de erro dos endpoints legados
