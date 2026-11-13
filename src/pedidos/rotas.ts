import { Router } from 'express';
import type { ErrorRequestHandler, Request, Response } from 'express';
import type { Base, FormaPagamento, Item } from './dados.js';
import { serializarPedido } from './serializar.js';

// Problem Details (RFC 9457), usado só pelos endpoints novos.
// Os endpoints antigos mantêm os formatos de erro que os clientes já usam.
interface Problema {
  tipo: string;
  titulo: string;
  status: number;
  detalhe: string;
  extensoes?: Record<string, unknown>;
}

function responderProblema(req: Request, res: Response, problema: Problema) {
  res
    .status(problema.status)
    .type('application/problem+json')
    .json({
      type: `https://techlog.example/problemas/${problema.tipo}`,
      title: problema.titulo,
      status: problema.status,
      detail: problema.detalhe,
      instance: req.originalUrl.split('?')[0],
      ...problema.extensoes,
    });
}

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

  // Endpoint novo: erros em Problem Details.
  // Ordem das verificações: corpo (400) → existência (404) → status (200 ou 409).
  rotas.post('/pedidos/:id/cancelamento', (req, res) => {
    const id = req.params.id;
    // Corpo com conteúdo que não é JSON é recusado. Content-Length: 0 conta
    // como sem corpo (o req.is sozinho o trataria como corpo não JSON).
    const temConteudo =
      req.headers['transfer-encoding'] !== undefined || Number(req.headers['content-length'] ?? 0) > 0;
    if (temConteudo && !req.is('application/json')) {
      responderProblema(
        req,
        res,
        requisicaoInvalida('O corpo, quando informado, deve ser JSON (Content-Type: application/json).'),
      );
      return;
    }
    const corpo = validarCorpoCancelamento(req.body);
    if ('problema' in corpo) {
      responderProblema(req, res, corpo.problema);
      return;
    }

    const resultado = base.cancelar(id, corpo.motivo);
    switch (resultado.resultado) {
      case 'cancelado':
      case 'ja-cancelado':
        res.status(200).json(serializarPedido(resultado.pedido));
        return;
      case 'nao-encontrado':
        responderProblema(req, res, {
          tipo: 'pedido-nao-encontrado',
          titulo: 'Pedido não encontrado',
          status: 404,
          detalhe: `Não existe pedido com o id ${id}.`,
          extensoes: { pedidoId: id },
        });
        return;
      case 'nao-cancelavel': {
        const status = resultado.pedido.status;
        const situacao = status === 'enviado' ? 'enviados' : 'entregues';
        responderProblema(req, res, {
          tipo: 'pedido-nao-cancelavel',
          titulo: 'Pedido não pode ser cancelado',
          status: 409,
          detalhe: `Pedidos já ${situacao} não podem ser cancelados. Status atual: ${status}.`,
          extensoes: { pedidoId: id, statusAtual: status },
        });
        return;
      }
    }
  });

  return rotas;
}

const LIMITE_MOTIVO = 500;

// Valida e normaliza o corpo do cancelamento. Sem corpo, motivo ausente, null,
// vazio ou só espaços contam como "sem motivo". O limite é contado em caracteres
// Unicode, depois do trim.
function validarCorpoCancelamento(corpo: unknown): { motivo: string | undefined } | { problema: Problema } {
  if (corpo === undefined) return { motivo: undefined };
  if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo)) {
    return { problema: requisicaoInvalida('O corpo, quando informado, deve ser um objeto JSON.') };
  }
  const motivo = (corpo as Record<string, unknown>).motivo;
  if (motivo === undefined || motivo === null) return { motivo: undefined };
  if (typeof motivo !== 'string') {
    return { problema: requisicaoInvalida('O campo motivo, quando informado, deve ser um texto.') };
  }
  const aparado = motivo.trim();
  if (aparado === '') return { motivo: undefined };
  const tamanho = [...aparado].length;
  if (tamanho > LIMITE_MOTIVO) {
    return {
      problema: {
        tipo: 'motivo-muito-longo',
        titulo: 'Motivo muito longo',
        status: 400,
        detalhe: `O motivo pode ter no máximo ${LIMITE_MOTIVO} caracteres; foram enviados ${tamanho}.`,
        extensoes: { limite: LIMITE_MOTIVO, tamanho },
      },
    };
  }
  return { motivo: aparado };
}

function requisicaoInvalida(detalhe: string): Problema {
  return { tipo: 'requisicao-invalida', titulo: 'Requisição inválida', status: 400, detalhe };
}

// O express.json() global falha antes da rota (JSON malformado, corpo grande
// demais, charset não suportado...). Este handler é montado em app.ts só no
// caminho do cancelamento, para que esses erros saiam em Problem Details sem
// mudar os endpoints antigos.
export const erroCorpoCancelamento: ErrorRequestHandler = (err, req, res, next) => {
  const status = err?.status ?? err?.statusCode;
  if (typeof err?.type !== 'string' || typeof status !== 'number' || status < 400 || status > 499) {
    next(err);
    return;
  }
  const detalhe =
    err.type === 'entity.parse.failed'
      ? 'O corpo da requisição não é um JSON válido.'
      : err.type === 'entity.too.large'
        ? 'O corpo da requisição é grande demais.'
        : 'O corpo da requisição não pôde ser lido.';
  responderProblema(req, res, { ...requisicaoInvalida(detalhe), status });
};

function lerPagamento(fp: any): FormaPagamento {
  if (fp?.tipo === 'cartao') {
    return { tipo: 'cartao', bandeira: fp.bandeira, parcelas: fp.parcelas, finalCartao: fp.final_cartao };
  }
  if (fp?.tipo === 'boleto') {
    return { tipo: 'boleto', linhaDigitavel: fp.linha_digitavel, vencimento: fp.vencimento };
  }
  return { tipo: 'pix', chave: fp?.chave };
}
