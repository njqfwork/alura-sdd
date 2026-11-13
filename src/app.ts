import express from 'express';
import { criarBase } from './pedidos/dados.js';
import { rotasPedidos } from './pedidos/rotas.js';
import { rotasCancelamento } from './pedidos/cancelamento.js';

export function criarApp() {
  const base = criarBase();
  const app = express();
  app.use(express.json());
  app.use(express.static('cliente'));
  app.use(rotasPedidos(base));
  app.use(rotasCancelamento(base));
  return app;
}
