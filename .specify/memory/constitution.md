<!--
Sync Impact Report
- Versão: 1.0.0 → 1.1.0 (MINOR: dois princípios novos e orientação ampliada no Princípio I)
- Princípios modificados:
  - I. Campos em camelCase → I. Campos novos em camelCase (campo existente só muda por
    depreciação, nunca por renomeação)
- Princípios adicionados:
  - V. O contrato OpenAPI é a fonte de verdade
  - VI. Pronto só com `npm run portoes` passando
- Seções alteradas:
  - Restrições Técnicas: o contrato deixa de ser `docs/api-pedidos.md` e passa a ser
    `openapi/openapi.yaml`
  - Fluxo de Desenvolvimento: conferência do PR passa a cobrir os seis princípios
- Seções removidas: nenhuma
- Templates: nenhum alterado (leem a constituição em tempo de execução)
- TODOs: nenhum
-->

# TechLog API Constitution

## Core Principles

### I. Campos novos em camelCase

- Todo campo novo em corpo de requisição, corpo de resposta ou parâmetro de query MUST usar
  camelCase (ex.: `valorTotal`, `criadoEm`).
- Campos que já existem (ex.: `valor_total`, `forma_pagamento`, `preco_unitario`) MUST NOT ser
  renomeados. Um campo existente só muda por depreciação: o campo novo em camelCase é adicionado,
  o antigo continua funcionando e é marcado como `deprecated: true` no contrato até ser retirado
  numa decisão registrada explicitamente.
- Um campo novo MUST NOT ser criado em snake_case para "combinar" com campos antigos vizinhos.

Justificativa: a API já mistura convenções e tem um cliente web em produção. Padronizar o que é
novo evita piorar a mistura; a depreciação dá um caminho de migração sem quebrar quem já consome
a API.

### II. Erros de endpoints novos em Problem Details (RFC 9457)

- Todo endpoint novo MUST responder erros no formato Problem Details (RFC 9457), com
  `Content-Type: application/problem+json` e os membros `type`, `title` e `status`; `detail` e
  `instance` quando ajudarem a pessoa que consome a API.
- Membros de extensão do Problem Details MUST seguir o Princípio I (camelCase).
- Endpoints que já existem MUST manter o formato de erro atual (`{ "erro": ... }` ou
  `{ "message", "code" }`), porque clientes dependem dele.

Justificativa: um formato de erro padronizado e documentado para o que é novo, sem quebrar
contratos de erro que já estão em uso.

### III. Regra de negócio nova tem teste automatizado

- Toda regra de negócio nova (validação, cálculo, transição de status, regra de pagamento) MUST
  vir acompanhada de pelo menos um teste automatizado que a exercite, no mesmo pull request.
- O teste MUST falhar se a regra for removida ou quebrada.
- Casos de erro previstos pela regra MUST ter teste, incluindo o corpo Problem Details quando o
  endpoint for novo.

Justificativa: a API está em produção; regra sem teste é regressão esperando para acontecer.

### IV. Mudanças pequenas, um pull request

- Cada mudança MUST caber num único pull request, revisável de uma vez.
- Uma feature que não cabe num PR MUST ser dividida em partes que possam ser entregues e
  revisadas separadamente, cada uma deixando a API funcionando.
- Um PR MUST NOT misturar a feature com refatorações ou renomeações não relacionadas.

Justificativa: PRs pequenos são mais fáceis de revisar, testar e reverter num sistema em produção.

### V. O contrato OpenAPI é a fonte de verdade

- O contrato da API é `openapi/openapi.yaml`, em OpenAPI 3.1. Ele é a fonte de verdade da
  interface: endpoints, campos, tipos, status e formatos de erro valem como estão nele.
- O que o plano de uma feature gerar na pasta `contracts/` é proposta. A mudança na interface só
  vale quando entra no `openapi/openapi.yaml`.
- Toda mudança na interface da API MUST alterar o `openapi/openapi.yaml` no mesmo PR que muda o
  código. Código e contrato MUST NOT divergir.

Justificativa: um único contrato, legível por máquina, permite lint, detecção de breaking change,
geração de tipos e teste de conformidade; propostas espalhadas pelas features não servem para isso.

### VI. Pronto só com `npm run portoes` passando

- Nenhuma tarefa está pronta sem `npm run portoes` passar, sem falhas, no estado final da mudança.
- Um portão que falha MUST ser corrigido na causa. Ele MUST NOT ser desligado, pulado ou
  enfraquecido para a tarefa passar, a menos que isso seja decidido e registrado explicitamente.

Justificativa: os portões reúnem num comando as verificações do contrato e do servidor; "pronto"
precisa ter um critério objetivo e igual para todas as tarefas.

## Restrições Técnicas

- Stack: Node.js, TypeScript e Express. Dependências novas MUST ser justificadas no PR.
- A API está em produção e é consumida por um cliente web (`cliente/`). Mudanças MUST NOT quebrar
  campos, formatos de erro ou comportamentos que esse cliente já usa, a menos que a quebra seja
  decidida e registrada explicitamente.
- O contrato da API é `openapi/openapi.yaml` (Princípio V) e MUST ser atualizado no mesmo PR que
  muda a API.

## Fluxo de Desenvolvimento

- Todo PR MUST ser conferido contra os seis princípios antes do merge: campos novos em camelCase
  e campos existentes só por depreciação, erros de endpoints novos em Problem Details, teste para
  cada regra de negócio nova, tamanho de um único PR, contrato atualizado no `openapi.yaml` e
  `npm run portoes` passando.
- Specs e planos (Spec Kit) MUST indicar, para cada campo e endpoint, se é novo ou existente, para
  que fique claro quais princípios se aplicam.
- Exceções a um princípio MUST ser justificadas por escrito no plano ou no PR.

## Governance

- Esta constituição prevalece sobre outras práticas do projeto. Em conflito, ela vence.
- Emendas MUST ser feitas por PR que altere este arquivo, com a justificativa da mudança.
- Versionamento semântico da constituição:
  - MAJOR: remoção ou redefinição incompatível de um princípio.
  - MINOR: princípio ou seção nova, ou orientação ampliada de forma material.
  - PATCH: esclarecimentos e ajustes de redação sem mudança de sentido.
- Revisões de PR MUST verificar a conformidade com esta constituição.

**Version**: 1.1.0 | **Ratified**: 2026-11-03 | **Last Amended**: 2026-11-05
