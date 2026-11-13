# Feature Specification: Cancelar pedido antes do envio

**Feature Branch**: `001-cancelar-pedido`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Permitir que um pedido seja cancelado antes de ser enviado. Quem opera a loja informa o pedido e, se quiser, um motivo. Pedidos já enviados ou entregues não podem ser cancelados, e quem tentou precisa entender por quê. Um pedido cancelado continua aparecendo na lista, com o status cancelado e a data do cancelamento."


## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cancelar um pedido que ainda não saiu (Priority: P1)

Quem opera a loja cancela um pedido criado ou pago, com ou sem motivo, e o pedido passa a constar como cancelado.

**Why this priority**: É o valor central da feature. Sem ela, pedidos desistidos seguem para a expedição.

**Independent Test**: Cancelar um pedido pago e conferir na lista o status cancelado e a data do cancelamento.

**Acceptance Scenarios**:

1. **Given** um pedido com status criado ou pago, **When** quem opera pede o cancelamento, **Then** o pedido passa a ter status cancelado e a data do cancelamento.
2. **Given** um pedido cancelado, **When** alguém consulta a lista de pedidos, **Then** o pedido aparece com status cancelado e a data do cancelamento.

---

### User Story 2 - Entender por que um pedido não pode ser cancelado (Priority: P2)

Quem tenta cancelar um pedido enviado ou entregue recebe uma recusa que explica o motivo.

**Why this priority**: Evita tentativas repetidas e chamados ao suporte.

**Independent Test**: Tentar cancelar um pedido enviado e ler a explicação da recusa.

**Acceptance Scenarios**:

1. **Given** um pedido com status enviado ou entregue, **When** alguém pede o cancelamento, **Then** o pedido não muda, e a resposta explica que só pedidos criados ou pagos podem ser cancelados.

### Edge Cases

- Cancelar de novo um pedido já cancelado devolve o pedido como está, sem mudar a data do cancelamento.
- Cancelar um pedido que não existe responde que o pedido não foi encontrado.
- Motivo com mais de 200 caracteres é recusado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE permitir cancelar pedidos com status criado ou pago.
- **FR-002**: O sistema DEVE recusar o cancelamento de pedidos enviados ou entregues, explicando o motivo.
- **FR-003**: O sistema DEVE registrar a data do cancelamento e, quando informado, o motivo.
- **FR-004**: O motivo DEVE ser opcional e ter no máximo 200 caracteres.
- **FR-005**: Cancelar um pedido já cancelado NÃO DEVE gerar erro nem alterar a data do cancelamento.
- **FR-006**: Pedidos cancelados DEVEM continuar na lista de pedidos.

### Key Entities

- **Pedido**: ganha o status cancelado, a data do cancelamento e o motivo opcional.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Todo pedido criado ou pago pode ser cancelado numa única ação.
- **SC-002**: Toda tentativa recusada traz uma explicação legível do motivo.

## Assumptions

- Autenticação está fora do escopo: a API ainda não tem.
- Reembolso, estoque e notificação ficam fora desta feature.

## Clarifications

### Session 2026-10-14

- Q: Cancelar um pedido já cancelado é erro? → A: Não. Devolve o pedido como está, sem mudar a data.
- Q: Qual o tamanho máximo do motivo? → A: Opcional, até 200 caracteres.
