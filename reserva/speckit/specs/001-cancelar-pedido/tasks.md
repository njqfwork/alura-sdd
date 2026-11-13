# Tasks: Cancelar pedido antes do envio

> Saída de reserva do vídeo 1.3.

## Phase 1: Setup

- [ ] T001 Conferir que `npm run dev` sobe a API e que os pedidos aparecem no cliente

## Phase 2: Foundational

- [ ] T002 Acrescentar o status cancelado e os campos `canceladoEm` e `motivoCancelamento` em `src/pedidos/dados.ts`
- [ ] T003 Criar `src/problemas.ts` com a resposta Problem Details (RFC 9457)

## Phase 3: User Story 1 - Cancelar um pedido que ainda não saiu (P1)

- [ ] T004 [US1] Criar a rota `POST /pedidos/{id}/cancelamento` em `src/pedidos/cancelamento.ts`
- [ ] T005 [US1] Registrar a rota em `src/app.ts`
- [ ] T006 [US1] Incluir os campos novos em `src/pedidos/serializar.ts`
- [ ] T007 [US1] Testes: cancelar pedido criado ou pago; cancelado aparece na lista

## Phase 4: User Story 2 - Entender por que não pode cancelar (P2)

- [ ] T008 [US2] Responder 409 com Problem Details para pedidos enviados ou entregues
- [ ] T009 [US2] Testes: recusa com explicação; pedido inexistente; cancelar duas vezes; motivo longo

## Phase 5: Polish

- [ ] T010 Rodar todos os testes e conferir o cliente no navegador
