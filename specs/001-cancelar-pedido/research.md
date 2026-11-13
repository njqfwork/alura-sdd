# Research: Cancelar pedido antes do envio

**Feature**: `specs/001-cancelar-pedido` | **Date**: 2026-11-03 | **Plan**: [plan.md](./plan.md)

O Technical Context não ficou com nenhum NEEDS CLARIFICATION: a stack, a estrutura, a rota e a
ferramenta de teste vieram do pedido do `/speckit-plan`. Este documento registra as decisões de
design que a spec não fixa. As decisões marcadas com **(decisão do agente)** não foram
confirmadas pela pessoa e estão listadas também em Assumptions, no fim do documento.

## R1. Onde fica a regra de cancelamento

- **Decision**: a regra fica num método novo `cancelar(id, motivo)` da base em memória
  (`src/pedidos/dados.ts`). Ele devolve um resultado discriminado (`cancelado`, `ja-cancelado`,
  `nao-encontrado`, `nao-cancelavel`). A rota (`src/pedidos/rotas.ts`) converte esse resultado em
  HTTP e Problem Details.
- **Rationale**: segue a estrutura que já existe em `src/pedidos` (rotas, base e serializador),
  como foi pedido. A regra de transição de status fica num lugar só, e a rota não decide
  elegibilidade.
- **Alternatives considered**: um arquivo novo `src/pedidos/cancelamento.ts` com a regra pura.
  Foi descartado porque cria uma camada que o projeto não tem e o pedido diz para usar a estrutura
  existente.

## R2. Rota e códigos de status

- **Decision**: `POST /pedidos/{id}/cancelamento` (endpoint **novo**), com corpo JSON opcional
  `{ "motivo": string }`.

  | Situação                                    | Status | Corpo                         |
  |---------------------------------------------|--------|-------------------------------|
  | Cancelado agora (`criado` ou `pago`)        | 200    | pedido serializado            |
  | Já estava `cancelado` (FR-006)              | 200    | pedido serializado, sem mudar |
  | Pedido não existe (FR-007)                  | 404    | Problem Details               |
  | Pedido `enviado` ou `entregue` (FR-005)     | 409    | Problem Details               |
  | `motivo` com mais de 500 caracteres (FR-008)| 400    | Problem Details               |
  | `motivo` não é texto, ou corpo não é objeto | 400    | Problem Details               |
  | JSON malformado                             | 400    | Problem Details               |

- **Rationale**: a rota foi definida no pedido. Usar 200 nos dois casos de sucesso deixa a
  repetição idêntica à primeira chamada, que é o que FR-006 pede. 409 indica conflito com o estado
  atual do recurso. 400 segue o código que a API já usa para validação em `POST /pedidos`.
- **Alternatives considered**: 201 na primeira chamada (o cancelamento como sub-recurso criado),
  descartado porque faria a repetição responder diferente. 422 para o motivo longo, descartado
  para manter o mesmo código de validação que a API já usa. **(decisão do agente)**

## R3. Ordem das validações

- **Decision**: (1) corpo e motivo → 400; (2) pedido existe → 404; (3) estado do pedido →
  200 (`cancelado`), 409 (`enviado`/`entregue`) ou cancela (`criado`/`pago`).
- **Rationale**: a validação do corpo não depende do estado. Validar primeiro faz um motivo
  inválido ser recusado sempre do mesmo jeito, inclusive num pedido já cancelado, e garante que
  nada muda quando a requisição é inválida (FR-008). **(decisão do agente)**
- **Alternatives considered**: procurar o pedido antes de validar o corpo. Daria 404 ou 200 para
  um motivo inválido conforme o estado, uma resposta menos previsível.

## R4. Problem Details: tipos e membros

- **Decision**: os erros do endpoint novo respondem `Content-Type: application/problem+json` com
  `type`, `title`, `status`, `detail` e `instance` (o caminho da requisição). Tipos estáveis:

  | `type`                                                   | Status | Extensões                  |
  |----------------------------------------------------------|--------|----------------------------|
  | `https://techlog.example/problemas/pedido-nao-encontrado`| 404    | `pedidoId`                 |
  | `https://techlog.example/problemas/pedido-nao-cancelavel`| 409    | `pedidoId`, `statusAtual`  |
  | `https://techlog.example/problemas/motivo-muito-longo`   | 400    | `limite`, `tamanho`        |
  | `https://techlog.example/problemas/requisicao-invalida`  | 400    | —                          |

  O `detail` do 409 muda conforme o status ("Pedidos já enviados não podem ser cancelados. Status
  atual: enviado." / "... já entregues ..."), como pedem os cenários 1 e 2 da User Story 2.
- **Rationale**: RFC 9457 e Princípio II. As extensões seguem camelCase (Princípio I). `statusAtual`
  permite ao cliente distinguir `enviado` de `entregue` sem ler texto. O domínio `.example` é
  reservado e não aponta para um servidor real, mas a RFC aceita `type` que não pode ser aberto.
- **Alternatives considered**: tipos separados `pedido-ja-enviado` e `pedido-ja-entregue`. Foi
  descartado porque a regra é a mesma, e `statusAtual` já diferencia os casos. `about:blank`
  foi descartado porque não daria um tipo estável por caso, que FR-009 exige. **(decisão do agente)**

## R5. JSON malformado no endpoint novo

- **Decision**: exportar de `src/pedidos/rotas.ts` um handler de erro e montá-lo em `src/app.ts`
  com `app.use('/pedidos/:id/cancelamento', handler)`, depois das rotas. Ele converte o erro
  `entity.parse.failed` do `express.json()` em Problem Details `requisicao-invalida`.
- **Rationale**: o `express.json()` é global e falha antes da rota. Testamos no Express 5 deste
  repositório: um handler de erro registrado dentro do `Router` **não** recebe esse erro e a
  resposta sai em HTML. Montado no app com o caminho, ele recebe o erro, e `POST /pedidos` com
  JSON malformado continua com a resposta de hoje (Princípio II, formato atual mantido).
- **Alternatives considered**: um handler de erro global, descartado porque mudaria os erros dos
  endpoints existentes. Um `express.json()` só na rota nova, descartado porque o global já consome
  o corpo antes.

## R6. Motivo: normalização e limite

- **Decision**: `motivo` ausente, `null`, vazio ou só com espaços conta como "sem motivo". Um
  motivo com texto é guardado sem os espaços das pontas (`trim`). O limite de 500 é contado em
  caracteres Unicode (`[...motivo].length`) depois do `trim`. Um `motivo` que não é string
  (número, objeto) é recusado com `requisicao-invalida`. **(decisão do agente)**
- **Rationale**: a spec diz que vazio ou só espaços equivale a "sem motivo". Contar em pontos de
  código evita que um emoji conte como dois caracteres para quem digita.
- **Alternatives considered**: `motivo.length` (unidades UTF-16), descartado porque o número não
  bate com o que a pessoa vê. Guardar o texto sem `trim`, descartado porque guardaria espaços sem
  significado.

## R7. Campos novos na resposta

- **Decision**: dois campos **novos**, `canceladoEm` (ISO 8601 UTC, igual a `criadoEm`) e
  `motivoCancelamento`, adicionados pelo serializador só quando existem no pedido. Os campos
  existentes não mudam.
- **Rationale**: Princípio I (camelCase), FR-012 e a clarificação de que os campos ficam de fora
  nos pedidos não cancelados. `canceladoEm` segue o padrão de `criadoEm`. `motivoCancelamento`
  é explícito no nível do pedido, onde `motivo` sozinho seria ambíguo.
- **Alternatives considered**: um objeto `cancelamento: { em, motivo }`, descartado porque a spec
  fala em campos de data e de motivo no pedido e porque um objeto aninhado muda mais a forma do
  pedido. **(decisão do agente)**

## R8. Concorrência

- **Decision**: não é preciso trava. O handler é síncrono e a base fica em memória num processo
  Node só. Duas requisições simultâneas são processadas uma depois da outra: a primeira cancela e
  a segunda cai em `ja-cancelado` (200 com a data e o motivo da primeira), como pede o edge case.
- **Rationale**: o event loop do Node não intercala código síncrono.
- **Alternatives considered**: nenhuma necessária enquanto a base for em memória.

## R9. Testes com `node:test` e `tsx`

- **Decision**: testes em `tests/pedidos/cancelamento.test.ts`, com `node:test` e
  `node:assert/strict`. Cada teste sobe `criarApp()` com `listen(0)` e chama a API com o `fetch`
  nativo. Script novo no `package.json`:
  `"test": "node --import tsx --test \"tests/**/*.test.ts\""`.
- **Rationale**: foi o pedido. O `tsx` já é dependência de desenvolvimento, então não entra
  dependência nova. O `fetch` nativo dispensa o `supertest`. `criarApp()` usa `criarBase()`, que
  devolve uma cópia nova da semente, então os testes não interferem uns nos outros.
  `tsconfig.json` já inclui `tests`.
- **Alternatives considered**: `supertest`, descartado porque seria dependência nova a justificar
  sem ganho real. Testar só a base sem HTTP, descartado porque o Princípio III exige testar o corpo
  Problem Details. Os dois níveis entram: o método da base e o endpoint.

## R10. Cliente web e contrato

- **Decision**: o cliente (`cliente/app.js`) não muda. Ele mostra `p.status` num selo, então
  `cancelado` aparece sem alteração, e ignora campos que não conhece. O contrato
  `docs/api-pedidos.md` ganha a seção do endpoint novo, os campos novos, o filtro
  `?status=cancelado` e os erros em Problem Details.
- **Rationale**: as Restrições Técnicas da constituição pedem contrato atualizado no mesmo PR.
- **Observação**: `docs/api-pedidos.md` já está desatualizado em relação ao código. O exemplo
  mostra `total` e `data_criacao`, mas a API devolve `valor_total` e `criadoEm`, e o doc não cita
  o formato `{ message, code }` de `POST /pedidos`. Corrigir isso não faz parte desta feature
  (Princípio IV). O plano só acrescenta o que é novo e deixa a correção para você decidir.

## Assumptions

Estas decisões são do agente e não foram confirmadas:

- 200 nos dois sucessos; 409 para `enviado`/`entregue`; 400 para validação (R2).
- A validação do corpo vem antes da busca do pedido (R3).
- Um único tipo `pedido-nao-cancelavel` com `statusAtual`, em vez de um tipo por status; URIs em
  `https://techlog.example/problemas/...` (R4).
- `trim` no motivo, limite contado em caracteres Unicode, motivo que não é texto é recusado (R6).
- Nomes `canceladoEm` e `motivoCancelamento`, campos no nível do pedido (R7).
- A divergência que já existe em `docs/api-pedidos.md` não é corrigida nesta feature (R10).
