import type { FormaPagamento, Pedido } from './dados.js';
import type { components } from '../gerado/api.js';

// Formato de resposta que os clientes já consomem.
// Os nomes misturam convenções porque a API cresceu em épocas diferentes:
// valor_total e forma_pagamento vieram da primeira versão,
// criadoEm entrou depois.
//
// O tipo de retorno vem do contrato (npm run gerar:tipos). Se o contrato e
// este arquivo divergirem, a compilação falha (npm run tipos).

type PedidoNoContrato = components['schemas']['Pedido'];

function pagamento(forma: FormaPagamento): PedidoNoContrato['forma_pagamento'] {
  switch (forma.tipo) {
    case 'cartao':
      return { tipo: 'cartao', bandeira: forma.bandeira, parcelas: forma.parcelas, final_cartao: forma.finalCartao };
    case 'pix':
      return { tipo: 'pix', chave: forma.chave };
    case 'boleto':
      return { tipo: 'boleto', linha_digitavel: forma.linhaDigitavel, vencimento: forma.vencimento };
  }
}

export function serializarPedido(p: Pedido): PedidoNoContrato {
  return {
    id: p.id,
    cliente: p.cliente,
    status: p.status,
    valor_total: p.valorTotal, // depreciado: use valorTotal
    valorTotal: p.valorTotal,
    criadoEm: p.criadoEm,
    forma_pagamento: pagamento(p.formaPagamento),
    itens: p.itens.map((i) => ({ sku: i.sku, quantidade: i.quantidade, preco_unitario: i.precoUnitario })),
  };
}
