---

description: "Lista de tarefas da feature Cancelar pedido antes do envio"
---

# Tasks: Cancelar pedido antes do envio

**Input**: documentos de design em `specs/001-cancelar-pedido/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/cancelamento.md](./contracts/cancelamento.md),
[quickstart.md](./quickstart.md)

**Tests**: incluídos. O Princípio III da constituição exige teste para toda regra de negócio nova,
incluindo o corpo Problem Details dos erros do endpoint novo. O plano define `node:test` +
`node:assert/strict` rodando com `tsx`, e o `fetch` nativo sobre `criarApp().listen(0)`.

**Organization**: tarefas agrupadas por user story, para que cada uma possa ser implementada e
testada de forma independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência de tarefa incompleta)
- **[Story]**: user story da tarefa (US1, US2, US3)

## Path Conventions

Projeto único na raiz: `src/`, `tests/`, `docs/`. Todos os testes ficam num arquivo só,
`tests/pedidos/cancelamento.test.ts`, como define o plano. Por isso as tarefas de teste da mesma
story não são [P] entre si.

Convenções que valem para todas as tarefas:

- Imports relativos com extensão `.js` (ESM + `NodeNext`), como em `src/app.ts`.
- Não renomear nem mudar campos existentes (`valor_total`, `criadoEm`, `forma_pagamento`,
  `final_cartao`, `linha_digitavel`, `preco_unitario`) nem os erros existentes
  (`{ erro }` em `GET /pedidos/:id` e `{ message, code }` em `POST /pedidos`).
- Cada teste HTTP sobe um `criarApp()` novo. `criarBase()` devolve uma cópia nova da semente, então
  os testes não interferem uns nos outros. Semente: PED-1001 `criado`, PED-1002 `pago`, PED-1003
  `enviado`, PED-1004 `entregue`, PED-1005 `pago`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: deixar o projeto pronto para rodar testes

- [X] T001 [P] Adicionar o script `"test": "node --import tsx --test \"tests/**/*.test.ts\""` em `scripts` de `package.json`, sem mexer nos outros scripts nem nas dependências (nenhuma dependência nova; `tsx` já é devDependency)
- [X] T002 [P] Criar `tests/pedidos/cancelamento.test.ts` com imports de `node:test` (`describe`, `it`, `before`/`after` ou `beforeEach`/`afterEach`), `node:assert/strict`, `criarApp` de `../../src/app.js` e `criarBase` de `../../src/pedidos/dados.js`. Incluir um helper `subirApp()` que faz `criarApp().listen(0)`, espera o evento `listening`, devolve `{ url, fechar }` com `url = http://localhost:<porta>` e `fechar()` que fecha o servidor. Incluir um helper `cancelar(url, id, corpo?)` que faz `fetch(\`${url}/pedidos/${id}/cancelamento\`, { method: 'POST' })`. Quando `corpo` é objeto, envia `JSON.stringify(corpo)` com `Content-Type: application/json`; quando é string, envia o texto cru com o mesmo header (para JSON malformado); quando é `undefined`, envia sem corpo. Ainda sem casos de teste; `npm test` deve rodar sem erro

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: tipos, serialização e o formato Problem Details de que as três stories dependem

**⚠️ CRITICAL**: nenhuma story começa antes desta fase terminar

- [X] T003 Em `src/pedidos/dados.ts`: mudar `Status` para `'criado' | 'pago' | 'enviado' | 'entregue' | 'cancelado'` e adicionar à interface `Pedido` os campos opcionais **novos** `canceladoEm?: string` (ISO 8601, mesmo formato de `criadoEm`) e `motivoCancelamento?: string`. Comentar as invariantes do data-model: "`canceladoEm` existe ⇔ `status === 'cancelado'`"; "`motivoCancelamento` existe ⇒ `status === 'cancelado'`; quando existe, tem `trim` aplicado, não é vazio e tem no máximo 500 caracteres Unicode"; "depois de gravados, `canceladoEm` e `motivoCancelamento` não mudam mais". Não alterar `SEMENTE`, `listar`, `buscar` nem `inserir`
- [X] T004 [P] Em `src/pedidos/serializar.ts`, na função `serializarPedido`, acrescentar no fim do objeto devolvido, depois de `itens`, `canceladoEm: p.canceladoEm` só quando `p.canceladoEm !== undefined` e `motivoCancelamento: p.motivoCancelamento` só quando `p.motivoCancelamento !== undefined` (por exemplo com spread condicional `...(p.canceladoEm !== undefined && { canceladoEm: p.canceladoEm })`). Nunca emitir a chave com `undefined` ou `null`: num pedido não cancelado a saída fica idêntica à de hoje (FR-012). Não mudar nenhum campo existente (depende de T003)
- [X] T005 [P] Em `src/pedidos/rotas.ts`, criar a função interna `responderProblema(req, res, problema)`. Ela recebe `{ tipo, titulo, status, detalhe, extensoes? }` e responde `res.status(status).type('application/problem+json').json({ type: \`https://techlog.example/problemas/${tipo}\`, title: titulo, status, detail: detalhe, instance: req.originalUrl.split('?')[0], ...extensoes })`. Os membros de extensão são sempre camelCase (Princípio I). A função fica no mesmo arquivo do handler de erro de T018, então não precisa ser exportada. Não mudar as rotas existentes

**Checkpoint**: `npx tsc` passa e a API se comporta exatamente como antes

---

## Phase 3: User Story 1 - Cancelar um pedido que ainda não foi enviado (Priority: P1) 🎯 MVP

**Goal**: `POST /pedidos/{id}/cancelamento` cancela pedidos `criado` ou `pago`, com motivo
opcional, e responde 200 com o pedido. Repetir a chamada num pedido já cancelado responde 200 sem
mudar nada.

**Independent Test**: cancelar PED-1001 sem motivo e PED-1002 com "cliente desistiu"; conferir
`status: "cancelado"`, `canceladoEm` e o motivo quando houver; repetir com outro motivo e conferir
que o corpo não muda (quickstart #1 a #4 e #10).

### Tests for User Story 1 ⚠️

> Escreva os testes antes e confirme que falham antes de implementar.

- [X] T006 [US1] Em `tests/pedidos/cancelamento.test.ts`, criar `describe('base: cancelar')` com testes sobre `criarBase()`: (a) `cancelar('PED-1001')` devolve `resultado: 'cancelado'`, o pedido fica com `status: 'cancelado'`, `canceladoEm` é uma string ISO válida (`!Number.isNaN(Date.parse(...))`) e não tem a propriedade `motivoCancelamento` (`assert.equal('motivoCancelamento' in pedido, false)`); (b) `cancelar('PED-1002', 'cliente desistiu')` grava `motivoCancelamento: 'cliente desistiu'`, e `formaPagamento`, `valorTotal` e `itens` continuam iguais aos de antes (FR-014); (c) chamar `cancelar('PED-1002', 'outro')` de novo devolve `resultado: 'ja-cancelado'`, com `canceladoEm` e `motivoCancelamento` iguais aos da primeira chamada (FR-006)
- [X] T007 [US1] Em `tests/pedidos/cancelamento.test.ts`, criar `describe('POST /pedidos/:id/cancelamento: sucesso')` usando `subirApp()`/`cancelar()`: (a) PED-1001 sem corpo → 200, `Content-Type` com `application/json`, `status: 'cancelado'`, `canceladoEm` ISO, sem a chave `motivoCancelamento`; (b) PED-1002 com `{ motivo: 'cliente desistiu' }` → 200 com `motivoCancelamento: 'cliente desistiu'`; (c) depois de (b), `GET /pedidos/PED-1002` devolve corpo `deepEqual` ao da resposta de (b) (US1-3); (d) repetir em PED-1002 com `{ motivo: 'outro' }` → 200 com corpo `deepEqual` ao de (b) (US1-4); (e) PED-1005 com `{ motivo: '   ' }` e com `{ motivo: '' }` → 200 sem a chave `motivoCancelamento`; (f) PED-1005 com `{ motivo: null }` → 200 sem `motivoCancelamento`; (g) PED-1001 com `{ motivo: '  cliente desistiu  ' }` → `motivoCancelamento: 'cliente desistiu'`; (h) num PED-1002 cancelado, `forma_pagamento`, `valor_total` e `itens` continuam iguais aos de `GET /pedidos/PED-1002` antes de cancelar (FR-014)

### Implementation for User Story 1

- [X] T008 [US1] Em `src/pedidos/dados.ts`, exportar o tipo `ResultadoCancelamento = { resultado: 'cancelado' | 'ja-cancelado' | 'nao-cancelavel'; pedido: Pedido } | { resultado: 'nao-encontrado' }` e adicionar à base de `criarBase()` o método `cancelar(id: string, motivo?: string): ResultadoCancelamento`. Regras: pedido inexistente → `{ resultado: 'nao-encontrado' }`; `status === 'cancelado'` → `{ resultado: 'ja-cancelado', pedido }` sem alterar nada; `status` `'enviado'` ou `'entregue'` → `{ resultado: 'nao-cancelavel', pedido }` sem alterar nada; `status` `'criado'` ou `'pago'` → muda `status` para `'cancelado'`, grava `canceladoEm = new Date().toISOString()` e, só se `motivo !== undefined`, grava `motivoCancelamento = motivo`, devolvendo `{ resultado: 'cancelado', pedido }`. O método não valida nem normaliza o motivo (isso é da rota) e não mexe em `formaPagamento` (FR-014). Todo o corpo é síncrono, sem `await`, para que duas chamadas seguidas mantenham os dados da primeira (R8) (depende de T003)
- [X] T009 [US1] Em `src/pedidos/rotas.ts`, adicionar a função interna `normalizarMotivo(valor: unknown): string | undefined`. Valor ausente (`undefined`), `null`, `""` ou só espaços → `undefined` ("sem motivo"); string com texto → `valor.trim()`. Os outros tipos e o limite de 500 são tratados em US2 (T015); por enquanto, valor que não é string → `undefined`
- [X] T010 [US1] Em `src/pedidos/rotas.ts`, dentro de `rotasPedidos`, registrar `rotas.post('/pedidos/:id/cancelamento', ...)` depois de `rotas.post('/pedidos', ...)`. O handler é síncrono: lê `const corpo = req.body ?? {}`, calcula `normalizarMotivo(corpo.motivo)`, chama `base.cancelar(req.params.id, motivo)` e, para `resultado` `'cancelado'` ou `'ja-cancelado'`, responde `res.status(200).json(serializarPedido(resultado.pedido))`. Para os outros resultados, por enquanto chama `next()`; T016 e T017 trocam isso por Problem Details (depende de T005, T008, T009)

**Checkpoint**: T006 e T007 passam (`npm test`); quickstart #1 a #4 e #10 funcionam

---

## Phase 4: User Story 2 - Entender por que um cancelamento foi recusado (Priority: P2)

**Goal**: toda recusa do endpoint novo responde Problem Details (RFC 9457), com tipo estável e
explicação legível, e nunca altera o pedido.

**Independent Test**: tentar cancelar PED-1003 (`enviado`), PED-1004 (`entregue`), PED-9999,
um motivo de 501 caracteres e JSON malformado; conferir cada corpo Problem Details e que nenhum
pedido mudou (quickstart #5 a #9 e #13).

### Tests for User Story 2 ⚠️

- [X] T011 [US2] Em `tests/pedidos/cancelamento.test.ts`, dentro de `describe('base: cancelar')`, adicionar: `cancelar('PED-1003')` → `resultado: 'nao-cancelavel'` com o pedido ainda `'enviado'` e sem `canceladoEm`; `cancelar('PED-1004')` → `'nao-cancelavel'` com o pedido ainda `'entregue'`; `cancelar('PED-9999')` → `{ resultado: 'nao-encontrado' }`
- [X] T012 [US2] Em `tests/pedidos/cancelamento.test.ts`, criar `describe('POST /pedidos/:id/cancelamento: recusas')` com um helper que confere `Content-Type` começando com `application/problem+json` e o corpo `deepEqual` ao esperado. Casos: (a) PED-1003 → 409, corpo `{ type: 'https://techlog.example/problemas/pedido-nao-cancelavel', title: 'Pedido não pode ser cancelado', status: 409, detail: 'Pedidos já enviados não podem ser cancelados. Status atual: enviado.', instance: '/pedidos/PED-1003/cancelamento', pedidoId: 'PED-1003', statusAtual: 'enviado' }`, e depois `GET /pedidos/PED-1003` ainda tem `status: 'enviado'` e não tem a chave `canceladoEm`; (b) PED-1004 → 409 com `detail: 'Pedidos já entregues não podem ser cancelados. Status atual: entregue.'` e `statusAtual: 'entregue'`, e o pedido continua `'entregue'`; (c) PED-9999 → 404, corpo `{ type: 'https://techlog.example/problemas/pedido-nao-encontrado', title: 'Pedido não encontrado', status: 404, detail: 'Não existe pedido com o id PED-9999.', instance: '/pedidos/PED-9999/cancelamento', pedidoId: 'PED-9999' }`
- [X] T013 [US2] Em `tests/pedidos/cancelamento.test.ts`, no mesmo `describe` de recusas, adicionar os casos de validação: (a) PED-1005 com `motivo` de 501 caracteres (`'a'.repeat(501)`) → 400, corpo `{ type: 'https://techlog.example/problemas/motivo-muito-longo', title: 'Motivo muito longo', status: 400, detail: 'O motivo pode ter no máximo 500 caracteres; foram enviados 501.', instance: '/pedidos/PED-1005/cancelamento', limite: 500, tamanho: 501 }`, e PED-1005 continua `'pago'`; (b) motivo `'a'.repeat(500)` → 200; (c) motivo `'😀'.repeat(500)` (1000 unidades UTF-16, 500 caracteres Unicode) → 200; (d) motivo `' '.repeat(10) + 'a'.repeat(500) + ' '.repeat(10)` → 200 (o limite conta depois do `trim`); (e) `{ motivo: 123 }` → 400 `type` `.../requisicao-invalida`, `title: 'Requisição inválida'`, `detail: 'O campo motivo, quando informado, deve ser um texto.'`; (f) corpo `[]` → 400 `.../requisicao-invalida`; (g) corpo string crua `'{"motivo":'` → 400 com `Content-Type` `application/problem+json` e `type` `.../requisicao-invalida`; (h) PED-1002 já cancelado + motivo de 501 → 400 `motivo-muito-longo` (validação antes do estado, R3); (i) PED-9999 + `{ motivo: 123 }` → 400, não 404 (R3)
- [X] T014 [US2] Em `tests/pedidos/cancelamento.test.ts`, criar `describe('erros dos endpoints existentes não mudam')`: (a) `GET /pedidos/PED-9999` → 404 com corpo `deepEqual` `{ erro: 'Pedido não encontrado' }` e `Content-Type` sem `problem+json`; (b) `POST /pedidos` com corpo `{}` → 400 com `deepEqual` `{ message: 'cliente é obrigatório', code: 'VALIDACAO' }`; (c) `POST /pedidos` com JSON malformado `'{"cliente":'` → 400 com `Content-Type` sem `problem+json` (Princípio II)

### Implementation for User Story 2

- [X] T015 [US2] Em `src/pedidos/rotas.ts`, criar a função interna `validarCorpoCancelamento(corpo: unknown)` que devolve `{ motivo: string | undefined }` ou um problema para `responderProblema`. Regras, nesta ordem: corpo `undefined` → sem motivo; corpo que não é objeto simples (`null`, array, número, string) → problema `requisicao-invalida`, 400, `title: 'Requisição inválida'`, `detail: 'O corpo, quando informado, deve ser um objeto JSON.'`; `motivo` ausente ou `null` → sem motivo; `motivo` que não é string → `requisicao-invalida`, 400, `detail: 'O campo motivo, quando informado, deve ser um texto.'`; string → `trim()`; vazia depois do `trim` → sem motivo; `[...motivoAparado].length > 500` → problema `motivo-muito-longo`, 400, `title: 'Motivo muito longo'`, `detail: \`O motivo pode ter no máximo 500 caracteres; foram enviados ${tamanho}.\``, extensões `{ limite: 500, tamanho }`. Limite citado do data-model: "string com mais de 500 após `trim` → 400 `motivo-muito-longo`". Use uma constante `LIMITE_MOTIVO = 500`. Remover `normalizarMotivo` de T009, que esta função substitui
- [X] T016 [US2] Em `src/pedidos/rotas.ts`, no handler de `POST /pedidos/:id/cancelamento`, chamar `validarCorpoCancelamento(req.body)` **antes** de `base.cancelar` e, se houver problema, responder com `responderProblema` sem chamar a base (R3). Passar `req.body` direto, sem `?? {}`, para que corpo ausente conte como "sem motivo" (depende de T015)
- [X] T017 [US2] Em `src/pedidos/rotas.ts`, no mesmo handler, trocar o `next()` de T010 por: `'nao-encontrado'` → `responderProblema` com `tipo: 'pedido-nao-encontrado'`, `titulo: 'Pedido não encontrado'`, 404, `detalhe: \`Não existe pedido com o id ${id}.\``, extensões `{ pedidoId: id }`; `'nao-cancelavel'` → `tipo: 'pedido-nao-cancelavel'`, `titulo: 'Pedido não pode ser cancelado'`, 409, `detalhe` igual a `'Pedidos já enviados não podem ser cancelados. Status atual: enviado.'` quando o status é `enviado` e a `'Pedidos já entregues não podem ser cancelados. Status atual: entregue.'` quando é `entregue`, extensões `{ pedidoId: id, statusAtual: pedido.status }`. Remover o parâmetro `next` se ele não for mais usado
- [X] T018 [US2] Em `src/pedidos/rotas.ts`, exportar o handler de erro `erroCorpoCancelamento(err, req, res, next)` (tipos `ErrorRequestHandler` do `express`). Se `err?.type === 'entity.parse.failed'`, responde `responderProblema` com `tipo: 'requisicao-invalida'`, `titulo: 'Requisição inválida'`, 400, `detalhe: 'O corpo da requisição não é um JSON válido.'`; senão, chama `next(err)` (depende de T005)
- [X] T019 [US2] Em `src/app.ts`, importar `erroCorpoCancelamento` de `./pedidos/rotas.js` e registrar `app.use('/pedidos/:id/cancelamento', erroCorpoCancelamento)` logo **depois** de `app.use(rotasPedidos(criarBase()))`. Precisa ser no app, não no `Router`: testado no Express 5 deste repositório, um handler de erro dentro do `Router` não recebe o erro do `express.json()` global (R5). Não adicionar handler de erro global (depende de T018)

**Checkpoint**: T011 a T014 passam, e os testes de US1 continuam passando; quickstart #5 a #9 e
#13 funcionam

---

## Phase 5: User Story 3 - Ver pedidos cancelados na lista (Priority: P3)

**Goal**: pedidos cancelados aparecem na lista geral e no filtro `?status=cancelado`, e os demais
saem idênticos ao formato de hoje.

**Independent Test**: cancelar um pedido e conferir `GET /pedidos` e `GET /pedidos?status=cancelado`;
conferir que pedidos não cancelados não têm os campos novos (quickstart #11 e #12).

### Tests for User Story 3 ⚠️

- [X] T020 [US3] Em `tests/pedidos/cancelamento.test.ts`, criar `describe('listagem com cancelados')`: (a) antes de cancelar, `GET /pedidos?status=cancelado` → `[]`; (b) cancelar PED-1001 sem motivo e PED-1002 com `{ motivo: 'cliente desistiu' }`, depois `GET /pedidos` → 5 pedidos, PED-1001 e PED-1002 com `status: 'cancelado'` e `canceladoEm`, PED-1002 com `motivoCancelamento: 'cliente desistiu'`; (c) `GET /pedidos?status=cancelado` → exatamente PED-1001 e PED-1002; (d) em `GET /pedidos`, PED-1003, PED-1004 e PED-1005 não têm as chaves `canceladoEm` nem `motivoCancelamento`
- [X] T021 [US3] Em `tests/pedidos/cancelamento.test.ts`, no mesmo `describe`, adicionar o teste de regressão de formato (FR-012, SC-005): `GET /pedidos/PED-1003` sem nenhum cancelamento → `deepEqual` ao literal `{ id: 'PED-1003', cliente: 'Carla Mendes', status: 'enviado', valor_total: 89.9, criadoEm: '2026-09-25T16:05:00Z', forma_pagamento: { tipo: 'boleto', linha_digitavel: '34191.79001 01043.510047 91020.150008 1 10010000008990', vencimento: '2026-10-02' }, itens: [{ sku: 'CX-GDE', quantidade: 1, preco_unitario: 89.9 }] }`, e o mesmo para `GET /pedidos/PED-1002` com `forma_pagamento: { tipo: 'cartao', bandeira: 'visa', parcelas: 2, final_cartao: '4242' }` (valores da `SEMENTE` em `src/pedidos/dados.ts`)

### Implementation for User Story 3

- [X] T022 [US3] Conferir que `listar(status)` em `src/pedidos/dados.ts` e `GET /pedidos` em `src/pedidos/rotas.ts` já atendem FR-010 e FR-011 sem mudança: o filtro compara `p.status === status` e o serializador de T004 inclui os campos novos. Só alterar código se T020 ou T021 falharem, e nesse caso corrigir em `src/pedidos/serializar.ts` (depende de T004, T010)

**Checkpoint**: todos os testes passam; quickstart #11 e #12 funcionam

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: contrato, verificação de tipos e validação ponta a ponta

- [X] T023 [P] Em `docs/api-pedidos.md`, acrescentar: em "Endpoints", a linha `` - `POST /pedidos/{id}/cancelamento` cancela um pedido `criado` ou `pago`. Corpo opcional `{ "motivo": "..." }` (até 500 caracteres). `` e a nota de que `?status=` aceita `cancelado`; uma seção "Cancelamento" com o exemplo de resposta 200, os campos novos `canceladoEm` e `motivoCancelamento` (só em pedidos cancelados) e a regra de repetição, conforme `specs/001-cancelar-pedido/contracts/cancelamento.md`; em "Erros", a explicação de que o endpoint de cancelamento responde Problem Details (`application/problem+json`) com os 4 tipos e status do contrato, e que os endpoints antigos mantêm o formato atual. **Não** corrigir o exemplo existente de "Campos do pedido" (`total`, `data_criacao`): isso ficou fora do escopo (research R10, Princípio IV)
- [X] T024 Rodar `npx tsc` (o `tsconfig.json` tem `noEmit` e inclui `src` e `tests`) e corrigir erros de tipo em `src/` ou `tests/`
- [X] T025 Rodar `npm test` e confirmar que todos os testes de `tests/pedidos/cancelamento.test.ts` passam. Para checar o Princípio III, comentar temporariamente o `if` de `'enviado'`/`'entregue'` em `cancelar()` de `src/pedidos/dados.ts`, confirmar que T011/T012 falham e restaurar o código
- [X] T026 Executar a validação manual de `specs/001-cancelar-pedido/quickstart.md` (#1 a #13 com `npm start`) e abrir `http://localhost:3000/` para conferir o selo `cancelado` no cliente web (`cliente/app.js` sem alteração)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências
- **Foundational (Phase 2)**: depende do Setup; bloqueia todas as stories
- **US1 (Phase 3)**: depende do Foundational
- **US2 (Phase 4)**: depende de US1, porque edita o handler criado em T010 (T016 e T017) e substitui `normalizarMotivo` (T015)
- **US3 (Phase 5)**: depende de US1 (precisa de pedidos cancelados, como a spec diz); não depende de US2
- **Polish (Phase 6)**: depende das stories que forem entregues

### Within Each User Story

- Os testes vêm primeiro e devem falhar antes da implementação
- `dados.ts` (base) → `rotas.ts` (rota) → `app.ts` (montagem)
- As tarefas no mesmo arquivo rodam em sequência, na ordem dos IDs

### Dependências entre tarefas (resumo)

- T003 → T004, T008
- T005 → T010, T018
- T008, T009 → T010
- T010 → T016, T017, T022
- T015 → T016
- T018 → T019

### Parallel Opportunities

- T001 ∥ T002 (arquivos diferentes)
- T004 ∥ T005 depois de T003 (`serializar.ts` × `rotas.ts`)
- T023 (docs) pode ser escrito em paralelo a qualquer fase depois do Foundational, porque o
  contrato já está definido
- Na US2, T018 (handler de erro) pode ser escrito junto com T011–T014, mas fica no mesmo arquivo
  que T015–T017, então vale fazer em sequência para evitar conflito
- US3 (T020–T022) pode correr em paralelo com US2 depois do checkpoint da US1, com cuidado porque
  as duas mexem em `tests/pedidos/cancelamento.test.ts`

---

## Parallel Example: Setup e Foundational

```bash
# Setup
Task: "T001 Adicionar script test em package.json"
Task: "T002 Criar tests/pedidos/cancelamento.test.ts com helpers subirApp/cancelar"

# Foundational, depois de T003
Task: "T004 Campos condicionais em src/pedidos/serializar.ts"
Task: "T005 responderProblema em src/pedidos/rotas.ts"
```

## Parallel Example: depois do checkpoint da US1

```bash
Task: "T023 Atualizar docs/api-pedidos.md"
Task: "T015–T019 Recusas em Problem Details (US2)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (T001–T002) e Phase 2 (T003–T005)
2. Phase 3 (T006–T010)
3. **Parar e validar**: `npm test` e quickstart #1–#4, #10
4. Atenção: no MVP, pedidos `enviado`/`entregue`/inexistentes ainda caem no 404 padrão do Express
   (`next()` de T010). Ainda não é entregável sozinho em produção. Pelo Princípio II, o PR só
   fecha com a US2

### Incremental Delivery (um PR, Princípio IV)

O escopo total (~4 arquivos de código, 1 de teste, `package.json` e o doc) cabe num único PR.
Commits sugeridos dentro dele:

1. Setup + Foundational
2. US1 → testes verdes
3. US2 → testes verdes, recusas em Problem Details
4. US3 → regressão de formato e filtro
5. Polish → contrato atualizado, `tsc` e quickstart

---

## Notes

- [P] = arquivo diferente, sem dependência pendente
- O rótulo [Story] liga a tarefa à user story da spec
- Valores de texto (`title`, `detail`, URIs de `type`) vêm de `contracts/cancelamento.md`; os
  testes conferem esses valores com `deepEqual`, então implementação e teste precisam usar
  exatamente o mesmo texto
- Não ler nem usar `prompts/`, `guia/`, `README.md` nem as branches de referência (CLAUDE.md)

---

## Phase 7: Convergence

- [X] T027 CRITICAL: Em `src/pedidos/rotas.ts`, ampliar `erroCorpoCancelamento` para que todo erro do body-parser no endpoint novo saia em Problem Details, e não só `entity.parse.failed`. Hoje um corpo acima do limite do `express.json()` responde 413 `text/html` com stack trace, e um charset não suportado responde 415 `text/html`. Quando `err` tiver `type` string e `status`/`statusCode` entre 400 e 499, responder `responderProblema` com esse status. Para `entity.parse.failed`, manter o tipo e o texto atuais. Para `entity.too.large`, usar o tipo `requisicao-invalida`, o título `'Requisição inválida'` e o detalhe `'O corpo da requisição é grande demais.'`. Para os demais, usar `requisicao-invalida` com o detalhe `'O corpo da requisição não pôde ser lido.'`. Os outros erros continuam indo para `next(err)`. Adicionar em `tests/pedidos/cancelamento.test.ts`, no `describe` de recusas, os testes de corpo > 100 KB (413, `application/problem+json`, PED-1005 continua `pago`) e de `Content-Type: application/json; charset=latin9` (415, `application/problem+json`). Atualizar a tabela de erros em `docs/api-pedidos.md` com esses dois status per Constitution II (contradicts)
- [X] T028 Em `src/pedidos/rotas.ts`, no handler de `POST /pedidos/:id/cancelamento`, antes de `validarCorpoCancelamento`, recusar um corpo enviado com tipo diferente de JSON. Se `req.is('application/json') === false` (há corpo e ele não é JSON; `null` quer dizer sem corpo), responder `requisicao-invalida`, 400, com o detalhe `'O corpo, quando informado, deve ser JSON (Content-Type: application/json).'`. O pedido não pode mudar. Adicionar um teste com `Content-Type: text/plain` e o corpo `cliente desistiu` (400, `application/problem+json`, PED-1001 continua `criado`) e manter o teste de sucesso sem corpo per plan: data-model "corpo que não é objeto JSON → 400" (partial)
- [X] T029 Em `tests/pedidos/cancelamento.test.ts`, adicionar o teste do edge case de concorrência: disparar com `Promise.all` dois `cancelar(url, 'PED-1002', { motivo: 'm1' })` e `{ motivo: 'm2' }`. Conferir que os dois respondem 200 com corpos `deepEqual` entre si e iguais a `GET /pedidos/PED-1002`, e que `motivoCancelamento` é um dos dois valores per Edge case "duas tentativas ao mesmo tempo" (partial)
- [X] T030 Decidir sobre as linhas `dist/` e `.env*` acrescentadas ao `.gitignore`, que nenhum artefato da feature pede: justificar na descrição do PR ou remover per Constitution IV (unrequested)
- [X] T031 Fazer a verificação visual que faltou em T026: com `npm start`, cancelar um pedido e abrir `http://localhost:3000/` no navegador, conferindo que o selo mostra `cancelado` e que os outros pedidos aparecem como antes. Observação: `cliente/index.html` define `.selo.cancelado`, mas `cliente/app.js` não põe a classe do status no selo. Mudar o cliente está fora do escopo da spec, então só registrar per SC-005 (partial)

---

## Phase 8: Convergence

- [X] T032 Atualizar `specs/001-cancelar-pedido/contracts/cancelamento.md` e `specs/001-cancelar-pedido/quickstart.md` com os casos acrescentados por T027 e T028. No contrato, entram três exemplos de `requisicao-invalida`: 413 com o detail `'O corpo da requisição é grande demais.'`, 415 com o detail `'O corpo da requisição não pôde ser lido.'` e 400 com o detail `'O corpo, quando informado, deve ser JSON (Content-Type: application/json).'`, cada um com o `type`, o `title` e o `instance` de sempre. A linha "Ordem das verificações" passa a abrir com "tipo e leitura do corpo (400/413/415)". No quickstart, acrescentar os cenários de corpo > 100 KB (413), de `Content-Type: application/json; charset=latin9` (415) e de `Content-Type: text/plain` (400, PED-1001 continua `criado`). Os textos precisam ser iguais aos de `src/pedidos/rotas.ts` e `docs/api-pedidos.md` per T027/T028 (partial)
