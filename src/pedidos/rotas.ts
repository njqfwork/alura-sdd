import { Router } from 'express';
import type { Base, FormaPagamento, Item } from './dados.js';
import { serializarPedido } from './serializar.js';

export function rotasPedidos(base: Base) {
  const rotas = Router();

  rotas.get('/pedidos', (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    res.json(base.listar(status).map(serializarPedido));
  });

  rotas.get('/pedidos/:id', (req, res) => {
    const pedido = base.buscar(req.params.id);
    if (!pedido) {
      // Formato de erro antigo, mantido porque clientes dependem dele.
      res.status(404).json({ erro: 'Pedido não encontrado' });
      return;
    }
    res.json(serializarPedido(pedido));
  });

  rotas.post('/pedidos', (req, res) => {
    const corpo = req.body ?? {};
    if (!corpo.cliente) {
      // Outro formato de erro, de outra época da API.
      res.status(400).json({ message: 'cliente é obrigatório', code: 'VALIDACAO' });
      return;
    }
    const itens: Item[] = corpo.itens.map((i: any) => ({
      sku: i.sku,
      quantidade: i.quantidade,
      precoUnitario: i.preco_unitario,
    }));
    const valorTotal = Math.round(itens.reduce((t, i) => t + i.quantidade * i.precoUnitario, 0) * 100) / 100;
    const formaPagamento = lerPagamento(corpo.forma_pagamento);
    const pedido = base.inserir({
      cliente: corpo.cliente,
      status: 'criado',
      itens,
      valorTotal,
      criadoEm: new Date().toISOString(),
      formaPagamento,
    });
    res.status(201).json(serializarPedido(pedido));
  });

  return rotas;
}

function lerPagamento(fp: any): FormaPagamento {
  if (fp?.tipo === 'cartao') {
    return { tipo: 'cartao', bandeira: fp.bandeira, parcelas: fp.parcelas, finalCartao: fp.final_cartao };
  }
  if (fp?.tipo === 'boleto') {
    return { tipo: 'boleto', linhaDigitavel: fp.linha_digitavel, vencimento: fp.vencimento };
  }
  return { tipo: 'pix', chave: fp?.chave };
}
