# Constituição da TechLog API

## Contexto

API REST de pedidos em Node, TypeScript e Express, já em produção, com um cliente web que a consome.

## Princípios

### I. Nomes em camelCase
Nomes de campos em camelCase.

### II. Erros no formato Problem Details
Erros de endpoints novos usam o formato Problem Details (RFC 9457), com `application/problem+json`.

### III. Regra de negócio com teste
Toda regra de negócio nova tem teste automatizado.

### IV. Mudanças pequenas
Cada mudança cabe num único pull request revisável.

## Governança

Esta constituição orienta o planejamento e a análise de cada feature. Mudanças nela são feitas com `/speckit-constitution`.

**Versão**: 1.0.0 | **Ratificada**: 2026-10-14
