# Feature Specification: Cancelar pedido antes do envio

**Feature Branch**: `main`

**Created**: 2026-11-03

**Status**: Draft

**Input**: User description: "Permitir que um pedido seja cancelado antes de ser enviado. Quem opera a loja informa o pedido e, se quiser, um motivo. Pedidos já enviados ou entregues não podem ser cancelados, e quem tentou precisa entender por quê. Um pedido cancelado continua aparecendo na lista, com o status cancelado e a data do cancelamento."

## Clarifications

### Session 2026-11-03

- Q: Quando um pedido já pago for cancelado, o estorno do pagamento faz parte desta feature? → A: Fora do escopo; o cancelamento só muda o status para cancelado, e o estorno, se houver, é outra feature.
- Q: O que acontece quando alguém tenta cancelar um pedido que já está cancelado? → A: Responde como sucesso e devolve o pedido cancelado como está, sem alterar data nem motivo.
- Q: Nos pedidos que não foram cancelados, a data de cancelamento e o motivo devem aparecer na resposta, sem valor, ou ficar de fora? → A: Ficar de fora; os campos só aparecem em pedidos cancelados, e os demais pedidos ficam idênticos a hoje.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cancelar um pedido que ainda não foi enviado (Priority: P1)

Quem opera a loja escolhe um pedido que ainda não saiu para entrega (status `criado` ou `pago`)
e o cancela, podendo informar um motivo. O pedido passa a ter o status `cancelado` e guarda a
data e a hora do cancelamento. Se o pedido já estiver cancelado, a ação é aceita e o pedido
continua como estava.

**Why this priority**: é o objetivo da feature. Sem isso, a loja não tem como desistir de um
pedido que ainda não foi enviado.

**Independent Test**: cancelar um pedido em `criado` e outro em `pago`, com e sem motivo, e
conferir que ambos passam a `cancelado`, com a data do cancelamento e o motivo quando informado;
depois repetir o cancelamento e conferir que nada muda.

**Acceptance Scenarios**:

1. **Given** um pedido com status `criado`, **When** quem opera a loja o cancela sem informar
   motivo, **Then** o pedido passa a `cancelado`, com a data do cancelamento e sem motivo.
2. **Given** um pedido com status `pago`, **When** quem opera a loja o cancela informando o motivo
   "cliente desistiu", **Then** o pedido passa a `cancelado`, com a data do cancelamento e o
   motivo "cliente desistiu".
3. **Given** um pedido acabou de ser cancelado, **When** alguém consulta esse pedido, **Then** vê
   o status `cancelado`, a data do cancelamento e o motivo, se houver.
4. **Given** um pedido já `cancelado`, **When** quem opera a loja o cancela de novo, com ou sem
   outro motivo, **Then** a ação é aceita como sucesso e o pedido é devolvido como estava, com a
   data e o motivo originais.

---

### User Story 2 - Entender por que um cancelamento foi recusado (Priority: P2)

Quem opera a loja tenta cancelar um pedido que não pode mais ser cancelado. O cancelamento é
recusado, o pedido não muda, e a resposta explica o motivo da recusa de forma que a pessoa
entenda o que aconteceu sem precisar consultar outra fonte.

**Why this priority**: a descrição exige que quem tentou entenda o porquê. Sem uma recusa clara,
a pessoa não sabe se o problema é o pedido, o status ou um erro do sistema.

**Independent Test**: tentar cancelar um pedido `enviado`, um `entregue` e um pedido que não
existe, e conferir que cada recusa traz uma explicação distinta e que nenhum pedido muda.

**Acceptance Scenarios**:

1. **Given** um pedido com status `enviado`, **When** quem opera a loja tenta cancelá-lo, **Then**
   o cancelamento é recusado, o pedido continua `enviado` e a resposta diz que pedidos já enviados
   não podem ser cancelados, informando o status atual.
2. **Given** um pedido com status `entregue`, **When** quem opera a loja tenta cancelá-lo, **Then**
   o cancelamento é recusado, o pedido continua `entregue` e a resposta diz que pedidos já
   entregues não podem ser cancelados, informando o status atual.
3. **Given** um identificador que não corresponde a nenhum pedido, **When** quem opera a loja tenta
   cancelá-lo, **Then** a resposta diz que o pedido não foi encontrado.

---

### User Story 3 - Ver pedidos cancelados na lista (Priority: P3)

Quem acompanha os pedidos continua vendo os cancelados na lista, com o status `cancelado` e a data
do cancelamento, e consegue filtrar a lista para ver só os cancelados.

**Why this priority**: mantém o histórico visível. Depende da User Story 1 para existir algum
pedido cancelado.

**Independent Test**: cancelar um pedido e conferir que ele aparece na lista geral e na lista
filtrada por `cancelado`, com o status e a data do cancelamento.

**Acceptance Scenarios**:

1. **Given** um pedido cancelado, **When** alguém consulta a lista de pedidos, **Then** o pedido
   aparece com o status `cancelado` e a data do cancelamento.
2. **Given** pedidos cancelados e não cancelados, **When** alguém filtra a lista pelo status
   `cancelado`, **Then** aparecem só os pedidos cancelados.
3. **Given** pedidos que nunca foram cancelados, **When** alguém consulta a lista, **Then** eles
   aparecem exatamente como antes, sem os campos de data de cancelamento e de motivo.

### Edge Cases

- Motivo vazio ou só com espaços é tratado como "sem motivo".
- Motivo maior que o limite permitido é recusado com explicação, e o pedido não é cancelado.
- Cancelar de novo um pedido já cancelado com um motivo diferente não troca o motivo original.
- Duas tentativas de cancelar o mesmo pedido ao mesmo tempo: as duas são aceitas, e o pedido fica
  com a data e o motivo da primeira que foi registrada.
- Um pedido cancelado não pode voltar a nenhum outro status por esta feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Quem opera a loja MUST conseguir cancelar um pedido informando qual é o pedido.
- **FR-002**: O cancelamento MUST aceitar um motivo opcional, em texto livre, de até 500
  caracteres.
- **FR-003**: Só pedidos com status `criado` ou `pago` MUST poder passar a `cancelado`.
- **FR-004**: Ao cancelar, o sistema MUST mudar o status do pedido para `cancelado` e registrar a
  data e a hora do cancelamento e o motivo, se houver.
- **FR-005**: O sistema MUST recusar o cancelamento de pedidos `enviado` ou `entregue`, sem alterar
  o pedido, e explicar que o pedido já foi enviado ou entregue, informando o status atual.
- **FR-006**: Pedir o cancelamento de um pedido já `cancelado` MUST ser aceito como sucesso e
  devolver o pedido como está, sem alterar a data, o motivo nem nenhum outro dado.
- **FR-007**: O sistema MUST recusar o cancelamento de um pedido inexistente e explicar que o pedido
  não foi encontrado.
- **FR-008**: O sistema MUST recusar um motivo acima do limite de FR-002 e explicar o limite.
- **FR-009**: Cada recusa MUST ter uma explicação legível por uma pessoa e um tipo de erro
  distinto e estável, para que o cliente web possa distinguir os casos.
- **FR-010**: Pedidos cancelados MUST continuar aparecendo na lista de pedidos e na consulta de um
  pedido, com o status `cancelado`, a data do cancelamento e o motivo, se houver.
- **FR-011**: A lista de pedidos MUST aceitar o filtro pelo status `cancelado`.
- **FR-012**: Pedidos não cancelados MUST continuar sendo apresentados com os mesmos campos e
  nomes de hoje; os campos de data de cancelamento e de motivo MUST NOT aparecer neles.
- **FR-013**: Os campos novos (data do cancelamento e motivo) MUST seguir camelCase, e as recusas
  do cancelamento MUST seguir Problem Details (RFC 9457), conforme a constituição.
- **FR-014**: O cancelamento MUST NOT fazer estorno nem qualquer outra operação sobre o pagamento;
  ele só muda o status e registra os dados do cancelamento.

### Key Entities

- **Pedido**: entidade já existente. Ganha o status `cancelado`, além de `criado`, `pago`,
  `enviado` e `entregue`.
- **Cancelamento**: dados registrados no pedido quando ele é cancelado: data e hora do
  cancelamento e motivo opcional. Só existem em pedidos cancelados.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Quem opera a loja cancela um pedido elegível numa única ação, sem passos adicionais.
- **SC-002**: 100% das tentativas de cancelar pedidos `enviado`, `entregue` ou inexistentes são
  recusadas, e nenhuma delas altera o pedido.
- **SC-003**: Em cada recusa, quem tentou consegue identificar o motivo só pela resposta, sem
  consultar outra fonte.
- **SC-004**: 100% dos pedidos cancelados aparecem na lista com status `cancelado` e data do
  cancelamento.
- **SC-005**: O cliente web atual continua exibindo os pedidos não cancelados exatamente como
  antes.
- **SC-006**: Repetir o cancelamento de um pedido já cancelado sempre resulta em sucesso e nunca
  altera a data nem o motivo registrados.

## Assumptions

- Pedidos com status `criado` e `pago` contam como "antes de ser enviado"; os dois podem ser
  cancelados.
- O limite do motivo é de 500 caracteres.
- Num pedido cancelado sem motivo, o campo de motivo fica de fora da resposta (mesma regra dos
  pedidos não cancelados).
- A API não tem autenticação hoje; "quem opera a loja" é quem chama a API, e controle de acesso
  fica fora do escopo.
- O cancelamento é uma ação nova da API, por isso as recusas seguem Problem Details. Os erros
  das ações existentes (consultar e criar pedido) mantêm o formato atual.
- A data do cancelamento é registrada no mesmo formato de data e hora que a data de criação do
  pedido.
- Mudanças no cliente web (botão de cancelar, por exemplo) ficam fora do escopo; o cliente só
  precisa continuar funcionando e exibir o status `cancelado`.
