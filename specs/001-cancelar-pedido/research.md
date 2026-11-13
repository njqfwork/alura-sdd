# Research: Cancelamento de pedido

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-05

Não ficou nenhum NEEDS CLARIFICATION no Technical Context: a stack, o endpoint e o test runner vieram do pedido do plano. As decisões abaixo cobrem os pontos que a spec deixou para o plano.

## R1. Onde fica a regra de transição

- **Decision**: uma função pura em `src/pedidos/cancelamento.ts` decide o resultado a partir do pedido e do motivo: `cancelado` (criado/pago → cancelado), `jaCancelado` (devolve como está) ou `naoCancelavel` (enviado/entregue, com o status atual). A base em memória (`src/pedidos/dados.ts`) ganha um método `cancelar(id, motivo, agora)` que procura o pedido, aplica a regra e grava a mudança.
- **Rationale**: a regra é de negócio nova (Princípio III) e precisa de teste que falhe se ela quebrar. Separada do Express, ela fica legível e fácil de exercitar pelos testes de aceite. Receber `agora` como parâmetro deixa a data determinística nos testes.
- **Alternatives considered**: regra dentro da rota (mistura HTTP com regra e repete o padrão mais confuso do `POST /pedidos`); regra só dentro de `criarBase()` (funciona, mas acopla a decisão ao armazenamento).

## R2. Concorrência

- **Decision**: nenhum mecanismo extra. O handler é síncrono entre ler o pedido e gravar o cancelamento.
- **Rationale**: o Node executa um handler síncrono sem intercalar outro. Duas requisições quase simultâneas são processadas em sequência: a primeira cancela e a segunda cai em `jaCancelado` (200, pedido como ficou), como pede a spec.
- **Alternatives considered**: trava ou versão otimista. Só fariam sentido com armazenamento externo, que está fora do escopo.

## R3. Corpo da requisição e validação

- **Decision**: corpo opcional `{ "motivo": string }`. Sem corpo, corpo `{}` ou `motivo` ausente contam como sem motivo. O motivo é aparado (trim); vazio depois de aparado conta como sem motivo; acima de 500 caracteres depois de aparado responde 400 `motivo-muito-longo`. Corpo que não é objeto JSON ou `motivo` que não é texto responde 400 `requisicao-invalida`. O corpo é validado antes de o pedido ser procurado.
- **Rationale**: segue a spec (FR-002, Edge Cases) e o comportamento descrito em `docs/api-pedidos.md`, que o cliente web (`cliente/app.js`) já usa ao mandar `{ "motivo": "Cancelado pelo painel" }`. Validar antes de procurar deixa a resposta independente do estado da base.
- **Alternatives considered**: rejeitar campos desconhecidos no corpo (o contrato não usa `additionalProperties: false` em nenhum lugar; seria uma convenção nova sem pedido).

## R4. Erros de parse do corpo em Problem Details só nesta rota

- **Decision**: um middleware de erro no router, montado só no caminho `/pedidos/:id/cancelamento`, converte os erros do `express.json()` em Problem Details: JSON malformado → 400, corpo grande demais → 413, charset/codificação não suportados → 415, todos com tipo `requisicao-invalida`. Corpo presente com `Content-Type` que não é JSON → 400 `requisicao-invalida`.
- **Rationale**: o Princípio II exige Problem Details em todo erro do endpoint novo, inclusive os que vêm do parser. Restringir ao caminho novo mantém intacto o comportamento atual de erro de `POST /pedidos` (restrição técnica: não quebrar o cliente).
- **Alternatives considered**: tratador de erro global (mudaria o formato de erro dos endpoints legados); parser próprio só na rota (duplica o `express.json()` que já está em `src/app.ts`).

## R5. Formato do Problem Details e URL dos tipos

- **Decision**: reaproveitar `responderProblema` de `src/problemas.ts`, adicionando um parâmetro opcional de extensões. Os tipos ficam em `https://api.techlog.example/problemas/{tipo}`, a base que esse helper já usa. Tipos: `pedido-nao-encontrado` (404, `pedidoId`), `pedido-nao-cancelavel` (409, `pedidoId`, `statusAtual`), `motivo-muito-longo` (400, `limite`, `tamanho`) e `requisicao-invalida` (400/413/415). `detail` explica em português o que aconteceu, por exemplo "Pedidos já enviados não podem ser cancelados. Status atual: enviado."
- **Rationale**: o helper já existe e implementa a RFC 9457; as extensões em camelCase atendem ao Princípio I. O cliente web só lê `detail`, então a base da URL não o afeta. `statusAtual` e `detail` cobrem FR-006 e SC-003.
- **Alternatives considered**: a base `https://techlog.example/problemas/` que aparece no `docs/api-pedidos.md`. Ficou de fora porque o código atual é a referência, e manter duas bases criaria uma inconsistência.

## R6. Resposta de sucesso

- **Decision**: `200 OK` com o pedido no mesmo formato de `GET /pedidos/{id}` (schema `Pedido`), tanto no cancelamento efetivo quanto no recancelamento.
- **Rationale**: a operação muda o estado de um recurso que já existe, não cria outro, então `201` não se aplica. Com `200` e o mesmo schema, o recancelamento é idempotente (Clarifications) e o cliente recebe o pedido atualizado sem nova consulta.
- **Alternatives considered**: `204` sem corpo (obrigaria uma segunda chamada para mostrar a data); `201` com um recurso "cancelamento" (exigiria modelar um recurso que a spec não pede).

## R7. Campos novos no Pedido

- **Decision**: dois campos opcionais novos no schema `Pedido`, em camelCase: `canceladoEm` (date-time) e `motivoCancelamento` (string). Os dois só aparecem em pedido cancelado, e `motivoCancelamento` só quando houve motivo. Nada é emitido como `null`. Nenhum campo existente muda.
- **Rationale**: o Princípio I exige camelCase em campo novo. Os nomes são os que o cliente web já lê (`p.canceladoEm`). Campo opcional novo na resposta não é breaking change (portão `contrato:quebras`). Omitir em vez de mandar `null` mantém a resposta de pedidos não cancelados idêntica à de hoje (FR-012).
- **Alternatives considered**: `canceladoEm: null` em todos os pedidos (muda a resposta de todos os pedidos e exigiria `type: [string, 'null']`).

## R8. Testes

- **Decision**: um arquivo novo, `tests/aceite/cancelamento.test.ts`, com `node:test` e `node:assert/strict`, rodando com `tsx --test` pelo script `test:aceite` (o glob `tests/aceite/*.test.ts` já o inclui). Os testes fazem requisições HTTP a um app real, como em `pedidos.test.ts`. Cada teste sobe um app novo (`criarApp()` com `listen(0)`), para que um cancelamento não afete o teste seguinte.
- **Rationale**: é o padrão que o projeto já usa e roda dentro de `npm run portoes` (Princípio VI). Testar pela HTTP cobre de uma vez a regra (III), o formato Problem Details e o serializador.
- **Alternatives considered**: um servidor compartilhado no `before()` (os testes ficariam dependentes de ordem, porque o cancelamento muda a base); testes unitários só da função pura (não pegariam erro de rota, de serialização ou de formato de erro).

## R9. Conformidade (Schemathesis) e contrato

- **Decision**: a operação nova entra no `openapi/openapi.yaml` com `operationId: cancelarPedido`, sem `x-legado`, e declara as respostas 200, 400, 404, 409, 413 e 415, as de erro como `application/problem+json`. O corpo da requisição tem `required: false` e `motivo` com `maxLength: 500`. Os tipos são regenerados com `npm run tipos`, e o serializador continua tipado pelo contrato.
- **Rationale**: o Spectral exige Problem Details em operação sem `x-legado`, caminho em kebab-case e operationId em camelCase. O Schemathesis (`response_schema_conformance`) vai chamar a rota com ids de exemplo e gerados, e cada status que ela pode devolver precisa estar documentado. A base é em memória e o servidor da conformidade é descartado no fim, então os cancelamentos feitos durante a verificação não importam.
- **Alternatives considered**: nenhuma; o Princípio V não deixa escolha.

## Fora do escopo (registrado para não virar escopo escondido)

- `docs/api-pedidos.md` está desatualizado em outros pontos (por exemplo, `total` e `data_criacao`) e foi substituído pelo `openapi/openapi.yaml` na constituição 1.1.0. Esta feature não o altera (Princípio IV).
- O cliente web já tem o botão de cancelar e não precisa de mudança.
