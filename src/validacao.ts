// Validação em tempo de execução contra o contrato.
// Ligada com VALIDAR_CONTRATO=1 (npm run dev:validado).
//
// Vale só para os endpoints novos (ignorePaths deixa o resto de fora, na requisição
// e na resposta). Ligar nos legados mudaria o comportamento que os clientes já
// conhecem; eles continuam conferidos pelo Schemathesis no CI.
// A resposta só é validada fora de produção, porque custa tempo a cada chamada.

import type { Express, NextFunction, Request, Response } from 'express';
import * as OpenApiValidator from 'express-openapi-validator';
import { responderProblema } from './problemas.js';

const ENDPOINTS_NOVOS = /\/cancelamento$/;

export function ligarValidacao(app: Express) {
  app.use(
    OpenApiValidator.middleware({
      apiSpec: 'openapi/openapi.yaml',
      validateRequests: true,
      validateResponses: process.env.NODE_ENV !== 'production',
      ignorePaths: (caminho: string) => !ENDPOINTS_NOVOS.test(caminho),
    }),
  );
}

export function tratarErroDeContrato(erro: any, req: Request, res: Response, next: NextFunction) {
  if (!erro?.status || !Array.isArray(erro.errors)) return next(erro);
  const detalhes = erro.errors.map((e: any) => `${e.path}: ${e.message}`).join('; ');
  if (erro.status >= 500) {
    // Resposta fora do contrato: falha nossa, não de quem chamou.
    console.error(`Resposta fora do contrato em ${req.method} ${req.path}: ${detalhes}`);
  }
  responderProblema(res, erro.status, 'fora-do-contrato', 'Fora do contrato', detalhes, req.path);
}
