import { Router } from 'express';
import type { Base } from './dados.js';
import { serializarPedido } from './serializar.js';
import { responderProblema } from '../problemas.js';

const CANCELAVEIS = new Set(['criado', 'pago']);
const LIMITE_MOTIVO = 200;

export function rotasCancelamento(base: Base) {
  const rotas = Router();

  rotas.post('/pedidos/:id/cancelamento', (req, res) => {
    const instancia = req.path;
    const pedido = base.buscar(req.params.id);
    if (!pedido) {
      responderProblema(res, 404, 'pedido-nao-encontrado', 'Pedido não encontrado',
        `Não existe pedido com o id ${req.params.id}.`, instancia);
      return;
    }

    const motivo = req.body?.motivo;
    if (motivo !== undefined && (typeof motivo !== 'string' || motivo.length > LIMITE_MOTIVO)) {
      responderProblema(res, 400, 'motivo-invalido', 'Motivo inválido',
        `O motivo é opcional e tem no máximo ${LIMITE_MOTIVO} caracteres.`, instancia);
      return;
    }

    if (pedido.status === 'cancelado') {
      res.json(serializarPedido(pedido));
      return;
    }

    if (!CANCELAVEIS.has(pedido.status)) {
      responderProblema(res, 409, 'cancelamento-nao-permitido', 'Cancelamento não permitido',
        `O pedido ${pedido.id} está com status ${pedido.status}. Só pedidos criados ou pagos podem ser cancelados.`,
        instancia);
      return;
    }

    pedido.status = 'cancelado';
    pedido.canceladoEm = new Date().toISOString();
    if (motivo) pedido.motivoCancelamento = motivo;
    res.json(serializarPedido(pedido));
  });

  return rotas;
}
