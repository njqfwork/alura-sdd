# Feature Specification: Cancelamento de pedido

**Feature Branch**: `cancelamento-na-esteira`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "Permitir que um pedido seja cancelado antes de ser enviado. Quem opera a loja informa o pedido e, se quiser, um motivo. Pedidos já enviados ou entregues não podem ser cancelados, e quem tentou precisa entender por quê. Um pedido cancelado continua aparecendo na lista, com o status cancelado e a data do cancelamento."

## Clarifications

### Session 2026-11-05

- Q: O que acontece quando alguém tenta cancelar um pedido que já está cancelado? → A: A operação é aceita como sucesso e devolve o pedido como está; um motivo novo é ignorado, e a data e o motivo do primeiro cancelamento não mudam.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cancelar um pedido que ainda não foi enviado (Priority: P1)

Quem opera a loja identifica um pedido que ainda não saiu para entrega (status criado ou pago) e o cancela, informando opcionalmente um motivo. O pedido passa a ter o status cancelado, com a data do cancelamento registrada.

**Why this priority**: é o núcleo da funcionalidade. Sem ele não há cancelamento; as outras histórias só fazem sentido depois desta.

**Independent Test**: pode ser testado cancelando um pedido com status criado e outro com status pago e conferindo que, depois disso, cada um aparece com status cancelado e com a data do cancelamento.

**Acceptance Scenarios**:

1. **Given** um pedido com status criado, **When** quem opera a loja pede o cancelamento sem motivo, **Then** o pedido passa a ter status cancelado e a data do cancelamento é registrada.
2. **Given** um pedido com status pago, **When** quem opera a loja pede o cancelamento informando o motivo "cliente desistiu", **Then** o pedido passa a ter status cancelado, a data do cancelamento é registrada e o motivo fica guardado com o pedido.
3. **Given** um pedido já cancelado, **When** quem opera a loja pede o cancelamento de novo, com ou sem outro motivo, **Then** a operação é aceita, o pedido é devolvido como está e a data e o motivo do primeiro cancelamento não mudam.
4. **Given** um pedido acabou de ser cancelado, **When** quem opera a loja consulta esse pedido, **Then** vê o status cancelado, a data do cancelamento e, se tiver sido informado, o motivo.

---

### User Story 2 - Entender por que um pedido não pode ser cancelado (Priority: P2)

Quem opera a loja tenta cancelar um pedido que já foi enviado ou entregue. O cancelamento é recusado, o pedido não muda, e a resposta diz com clareza por que não foi possível: o pedido já está enviado (ou entregue) e só pedidos que ainda não foram enviados podem ser cancelados.

**Why this priority**: protege a operação de um cancelamento indevido e evita que quem opera fique sem saber o que aconteceu. Depende da história 1 existir para ter o que recusar.

**Independent Test**: pode ser testado tentando cancelar um pedido enviado e um entregue e conferindo que ambos continuam com o status original e que a resposta informa o status atual do pedido e o motivo da recusa.

**Acceptance Scenarios**:

1. **Given** um pedido com status enviado, **When** quem opera a loja pede o cancelamento, **Then** o cancelamento é recusado, o pedido continua com status enviado e a resposta explica que pedidos já enviados não podem ser cancelados, informando o status atual.
2. **Given** um pedido com status entregue, **When** quem opera a loja pede o cancelamento, **Then** o cancelamento é recusado, o pedido continua com status entregue e a resposta explica que pedidos já entregues não podem ser cancelados, informando o status atual.
3. **Given** um identificador que não corresponde a nenhum pedido, **When** quem opera a loja pede o cancelamento, **Then** a resposta informa que o pedido não foi encontrado.

---

### User Story 3 - Ver pedidos cancelados na lista (Priority: P3)

Ao consultar a lista de pedidos, quem opera a loja continua vendo os pedidos cancelados, cada um com o status cancelado e a data do cancelamento, e pode filtrar a lista para ver só os cancelados.

**Why this priority**: dá visibilidade e histórico do que foi cancelado. A lista e o filtro por status já existem; esta história garante que o cancelamento apareça neles corretamente.

**Independent Test**: pode ser testado cancelando um pedido e conferindo que ele aparece na lista completa e na lista filtrada por cancelado, com a data do cancelamento, e que deixa de aparecer no filtro pelo status anterior.

**Acceptance Scenarios**:

1. **Given** um pedido foi cancelado, **When** quem opera a loja consulta a lista de pedidos sem filtro, **Then** o pedido aparece na lista com status cancelado e com a data do cancelamento.
2. **Given** um pedido que estava pago foi cancelado, **When** quem opera a loja filtra a lista por cancelado, **Then** o pedido aparece; **When** filtra por pago, **Then** o pedido não aparece.
3. **Given** um pedido que nunca foi cancelado, **When** aparece na lista, **Then** não traz data de cancelamento nem motivo, e o restante das informações do pedido continua como antes.

---

### Edge Cases

- Cancelar um pedido que já está cancelado: aceito sem mudar nada; o primeiro cancelamento (data e motivo) é preservado e um motivo novo é ignorado.
- Cancelar um pedido inexistente: resposta de pedido não encontrado.
- Motivo vazio ou só com espaços: tratado como "sem motivo"; o cancelamento acontece normalmente.
- Motivo longo demais (mais de 500 caracteres): o cancelamento é recusado com explicação do limite, e o pedido não muda.
- Dois pedidos de cancelamento quase simultâneos para o mesmo pedido: só o primeiro efetiva o cancelamento; o outro recebe o pedido como ficou, com a data e o motivo do primeiro.
- Pedidos que já constavam como cancelados antes desta funcionalidade (sem data de cancelamento registrada): continuam aparecendo na lista como cancelados, sem data de cancelamento.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir que quem opera a loja cancele um pedido informando o identificador do pedido.
- **FR-002**: O sistema MUST aceitar, de forma opcional, um motivo em texto livre junto do pedido de cancelamento, com até 500 caracteres.
- **FR-003**: O sistema MUST permitir o cancelamento apenas de pedidos com status criado ou pago.
- **FR-004**: Ao cancelar, o sistema MUST mudar o status do pedido para cancelado e registrar a data e hora do cancelamento.
- **FR-005**: Ao cancelar com motivo, o sistema MUST guardar o motivo junto do pedido e exibi-lo sempre que o pedido for consultado.
- **FR-006**: O sistema MUST recusar o cancelamento de pedidos com status enviado ou entregue, sem alterar o pedido, e MUST informar na resposta que o pedido não pode ser cancelado, por quê, e qual é o status atual do pedido.
- **FR-007**: O sistema MUST aceitar como sucesso o pedido de cancelamento de um pedido já cancelado, devolvendo o pedido como está, sem alterar a data nem o motivo registrados e ignorando um motivo novo.
- **FR-008**: O sistema MUST informar que o pedido não foi encontrado quando o identificador não corresponder a nenhum pedido.
- **FR-009**: Uma recusa de cancelamento MUST ser distinguível de um erro de dados inválidos (por exemplo, motivo longo demais) e de pedido não encontrado, para que quem opera saiba o que fazer.
- **FR-010**: Pedidos cancelados MUST continuar aparecendo na lista de pedidos e na consulta individual, com status cancelado e a data do cancelamento.
- **FR-011**: O filtro da lista por status cancelado MUST trazer os pedidos cancelados por esta funcionalidade.
- **FR-012**: A inclusão da data do cancelamento e do motivo MUST NOT alterar nem remover nenhuma informação que a lista e a consulta de pedidos já devolvem hoje; pedidos não cancelados continuam sendo apresentados como antes.
- **FR-013**: As respostas de erro da operação de cancelamento (que é nova) MUST seguir o formato padronizado de erros adotado para operações novas do projeto; as operações que já existem mantêm seus formatos de erro atuais.

### Key Entities *(include if feature involves data)*

- **Pedido** (existente): pedido de um cliente da loja, com status, itens, valor e forma de pagamento. Ganha duas informações novas, presentes só quando o pedido foi cancelado:
  - **Data do cancelamento** (nova): data e hora em que o cancelamento foi efetivado.
  - **Motivo do cancelamento** (novo): texto opcional informado por quem cancelou.
- **Status do pedido** (existente): criado, pago, enviado, entregue, cancelado. Nenhum status novo é criado; o valor cancelado já existe e passa a ser alcançável pela operação de cancelamento, a partir de criado ou pago.
- **Operação de cancelamento** (nova): ação de quem opera a loja sobre um pedido existente, com motivo opcional.
- **Lista de pedidos e consulta de pedido** (existentes): passam a mostrar as informações novas de cancelamento, sem mudar o que já mostram.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Quem opera a loja consegue cancelar um pedido elegível em uma única ação, informando só o pedido (e, se quiser, o motivo).
- **SC-002**: 100% das tentativas de cancelar pedidos enviados ou entregues são recusadas, e em 100% delas o pedido permanece com o status que tinha antes.
- **SC-003**: Em 100% das recusas, a resposta informa o status atual do pedido e o motivo da recusa, de forma que quem tentou entenda o que aconteceu sem consultar outra fonte.
- **SC-004**: 100% dos pedidos cancelados aparecem na lista de pedidos com status cancelado e com a data do cancelamento.
- **SC-005**: Quem já consome a lista e a consulta de pedidos continua funcionando sem nenhuma mudança depois da entrega da funcionalidade.

## Assumptions

- Só pedidos com status criado ou pago podem ser cancelados; "antes de ser enviado" foi interpretado como esses dois status.
- Cancelar um pedido pago não dispara estorno nem qualquer ação de pagamento; reembolso fica fora do escopo desta funcionalidade.
- O motivo é texto livre de até 500 caracteres; motivo vazio ou só com espaços equivale a não informar motivo.
- O motivo, quando informado, aparece junto do pedido na lista e na consulta, ao lado da data do cancelamento.
- Não há autenticação nem perfis de acesso na API hoje; "quem opera a loja" é quem tem acesso à API, e não se registra quem fez o cancelamento.
- Um pedido cancelado não pode voltar a outro status; desfazer cancelamento fica fora do escopo.
- Pedidos que já estavam cancelados antes desta funcionalidade não têm data de cancelamento e continuam sem ela.
- Mudanças no cliente web (`cliente/`) para oferecer o cancelamento na tela ficam fora do escopo desta especificação.
