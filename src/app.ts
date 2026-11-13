import express from 'express';
import { criarBase } from './pedidos/dados.js';
import { rotasPedidos } from './pedidos/rotas.js';

export function criarApp() {
  const base = criarBase();
  const app = express();
  app.use(express.json());
  app.use(express.static('cliente'));
  app.use(rotasPedidos(base));
  return app;
}
