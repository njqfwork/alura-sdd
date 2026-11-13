import express from 'express';
import { criarBase } from './pedidos/dados.js';
import { erroCorpoCancelamento, rotasPedidos } from './pedidos/rotas.js';

export function criarApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static('cliente'));
  app.use(rotasPedidos(criarBase()));
  // Precisa ficar no app, e não no Router: um handler de erro dentro do Router
  // não recebe o erro do express.json() global.
  app.use('/pedidos/:id/cancelamento', erroCorpoCancelamento);
  return app;
}
