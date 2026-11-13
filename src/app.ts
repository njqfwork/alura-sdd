import express from 'express';
import { criarBase } from './pedidos/dados.js';
import { rotasPedidos } from './pedidos/rotas.js';
import { rotasCancelamento } from './pedidos/cancelamento.js';
import { ligarValidacao, tratarErroDeContrato } from './validacao.js';

export function criarApp() {
  const base = criarBase();
  const app = express();
  app.use(express.json());
  app.use(express.static('cliente'));

  // Validação contra o contrato em tempo de execução.
  const validar = process.env.VALIDAR_CONTRATO === '1';
  if (validar) ligarValidacao(app);

  app.use(rotasPedidos(base));
  app.use(rotasCancelamento(base));

  if (validar) app.use(tratarErroDeContrato);
  return app;
}
