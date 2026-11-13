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
    // Correção: antes, só o cliente era conferido, e um pedido
    // sem itens derrubava a API com erro 500. O formato de erro continua o antigo.
    const problema = validarNovoPedido(corpo);
    if (problema) {
      res.status(400).json({ message: problema, code: 'VALIDACAO' });
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

function validarNovoPedido(corpo: any): string | null {
  if (typeof corpo.cliente !== 'string' || !corpo.cliente) return 'cliente é obrigatório';
  if (!Array.isArray(corpo.itens) || corpo.itens.length === 0) return 'itens é obrigatório';
  for (const i of corpo.itens) {
    if (typeof i?.sku !== 'string') return 'sku do item é obrigatório';
    if (!Number.isInteger(i.quantidade) || i.quantidade < 1) return 'quantidade deve ser um inteiro maior que zero';
    if (typeof i.preco_unitario !== 'number' || i.preco_unitario < 0) return 'preco_unitario deve ser um número';
  }
  const fp = corpo.forma_pagamento;
  const texto = (v: unknown) => typeof v === 'string';
  const valida =
    (fp?.tipo === 'cartao' && texto(fp.bandeira) && Number.isInteger(fp.parcelas) && fp.parcelas >= 1 &&
      texto(fp.final_cartao) && /^[0-9]{4}$/.test(fp.final_cartao)) ||
    (fp?.tipo === 'pix' && texto(fp.chave)) ||
    (fp?.tipo === 'boleto' && texto(fp.linha_digitavel) && dataValida(fp.vencimento));
  if (!valida) return 'forma_pagamento inválida';
  // Quantidade e preço enormes estouram o total, que viraria null no JSON.
  const total = corpo.itens.reduce((t: number, i: any) => t + i.quantidade * i.preco_unitario, 0);
  if (!Number.isFinite(total)) return 'valor total fora do limite';
  return null;
}

// O contrato declara vencimento como format: date, no formato AAAA-MM-DD.
function dataValida(v: unknown) {
  if (typeof v !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
}

function lerPagamento(fp: any): FormaPagamento {
  if (fp.tipo === 'cartao') {
    return { tipo: 'cartao', bandeira: fp.bandeira, parcelas: fp.parcelas, finalCartao: fp.final_cartao };
  }
  if (fp.tipo === 'boleto') {
    return { tipo: 'boleto', linhaDigitavel: fp.linha_digitavel, vencimento: fp.vencimento };
  }
  return { tipo: 'pix', chave: fp.chave };
}
