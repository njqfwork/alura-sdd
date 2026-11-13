# Implementation Plan: Cancelar pedido antes do envio

**Branch**: `001-cancelar-pedido` | **Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)

> Saída de reserva do vídeo 1.3.

## Summary

Novo endpoint `POST /pedidos/{id}/cancelamento` no módulo de Pedidos, reaproveitando as rotas Express, a base em memória e o serializador existentes.

## Technical Context

**Language/Version**: TypeScript em Node 24

**Primary Dependencies**: Express 5

**Storage**: base em memória (`src/pedidos/dados.ts`)

**Testing**: node:test, rodando com tsx

**Project Type**: web-service

## Constitution Check

- I. camelCase: campos novos `canceladoEm` e `motivoCancelamento` seguem o princípio.
- II. Problem Details: as recusas do novo endpoint usam `application/problem+json`.
- III. Teste: cada critério de aceite tem um teste.
- IV. Mudança pequena: um endpoint, um pull request.

## Project Structure

```text
specs/001-cancelar-pedido/
├── plan.md
├── data-model.md
├── contracts/cancelamento.md
└── tasks.md

src/
├── problemas.ts                # resposta Problem Details
└── pedidos/
    ├── cancelamento.ts         # rota nova
    ├── dados.ts                # status cancelado e campos novos
    └── serializar.ts           # campos novos na resposta

tests/
└── cancelamento.test.ts
```

**Structure Decision**: segue o módulo `src/pedidos` existente.
