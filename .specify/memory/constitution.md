<!--
Sync Impact Report
- Versão: (modelo sem preencher) → 1.0.0
- Princípios definidos (4, conforme pedido; o modelo previa 5):
  - I. Campos em camelCase
  - II. Erros de endpoints novos em Problem Details (RFC 9457)
  - III. Regra de negócio nova tem teste automatizado
  - IV. Mudanças pequenas, um pull request
- Seções adicionadas: Restrições Técnicas, Fluxo de Desenvolvimento, Governança
- Seções removidas: PRINCIPLE_5 do modelo (o projeto tem 4 princípios)
- Templates: nenhum alterado (leem a constituição em tempo de execução)
- TODOs: nenhum. Data de ratificação assumida como a data desta primeira adoção.
-->

# TechLog API Constitution

## Core Principles

### I. Campos em camelCase

- Todo campo novo em corpo de requisição, corpo de resposta ou parâmetro de query MUST usar
  camelCase (ex.: `valorTotal`, `criadoEm`).
- Campos que já existem em produção com outro formato (ex.: `valor_total`, `forma_pagamento`,
  `preco_unitario`) MUST manter o nome atual. Este princípio não autoriza renomeá-los.
- Um campo novo MUST NOT ser criado em snake_case para "combinar" com campos antigos vizinhos.

Justificativa: a API já mistura convenções e tem um cliente web em produção. Padronizar o que é
novo evita piorar a mistura sem quebrar quem já consome a API.

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

## Restrições Técnicas

- Stack: Node.js, TypeScript e Express. Dependências novas MUST ser justificadas no PR.
- A API está em produção e é consumida por um cliente web (`cliente/`). Mudanças MUST NOT quebrar
  campos, formatos de erro ou comportamentos que esse cliente já usa, a menos que a quebra seja
  decidida e registrada explicitamente.
- O contrato da API (`docs/api-pedidos.md`) MUST ser atualizado no mesmo PR que muda a API.

## Fluxo de Desenvolvimento

- Todo PR MUST ser conferido contra os quatro princípios antes do merge: campos novos em
  camelCase, erros de endpoints novos em Problem Details, teste para cada regra de negócio nova e
  tamanho de um único PR.
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

**Version**: 1.0.0 | **Ratified**: 2026-11-03 | **Last Amended**: 2026-11-03
