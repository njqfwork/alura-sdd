// Base em memória do módulo de Pedidos. Os dados são fictícios.
// Cada chamada a criarBase() devolve uma cópia nova, para que os testes
// e as execuções não interfiram umas nas outras.

export type Status = 'criado' | 'pago' | 'enviado' | 'entregue' | 'cancelado';

export type FormaPagamento =
  | { tipo: 'cartao'; bandeira: string; parcelas: number; finalCartao: string }
  | { tipo: 'pix'; chave: string }
  | { tipo: 'boleto'; linhaDigitavel: string; vencimento: string };

export interface Item {
  sku: string;
  quantidade: number;
  precoUnitario: number;
}

export interface Pedido {
  id: string;
  cliente: string;
  status: Status;
  itens: Item[];
  valorTotal: number;
  criadoEm: string;
  formaPagamento: FormaPagamento;
}

const SEMENTE: Pedido[] = [
  {
    id: 'PED-1001',
    cliente: 'Ana Souza',
    status: 'criado',
    itens: [{ sku: 'CX-PEQ', quantidade: 2, precoUnitario: 39.9 }],
    valorTotal: 79.8,
    criadoEm: '2026-09-28T10:15:00Z',
    formaPagamento: { tipo: 'pix', chave: 'ana.souza@exemplo.com' },
  },
  {
    id: 'PED-1002',
    cliente: 'Bruno Lima',
    status: 'pago',
    itens: [
      { sku: 'CX-MED', quantidade: 1, precoUnitario: 59.9 },
      { sku: 'FITA-50', quantidade: 3, precoUnitario: 12.5 },
    ],
    valorTotal: 97.4,
    criadoEm: '2026-09-29T08:40:00Z',
    formaPagamento: { tipo: 'cartao', bandeira: 'visa', parcelas: 2, finalCartao: '4242' },
  },
  {
    id: 'PED-1003',
    cliente: 'Carla Mendes',
    status: 'enviado',
    itens: [{ sku: 'CX-GDE', quantidade: 1, precoUnitario: 89.9 }],
    valorTotal: 89.9,
    criadoEm: '2026-09-25T16:05:00Z',
    formaPagamento: {
      tipo: 'boleto',
      linhaDigitavel: '34191.79001 01043.510047 91020.150008 1 10010000008990',
      vencimento: '2026-10-02',
    },
  },
  {
    id: 'PED-1004',
    cliente: 'Diego Rocha',
    status: 'entregue',
    itens: [{ sku: 'CX-PEQ', quantidade: 5, precoUnitario: 39.9 }],
    valorTotal: 199.5,
    criadoEm: '2026-09-20T11:30:00Z',
    formaPagamento: { tipo: 'cartao', bandeira: 'master', parcelas: 1, finalCartao: '5100' },
  },
  {
    id: 'PED-1005',
    cliente: 'Elisa Prado',
    status: 'pago',
    itens: [{ sku: 'ETQ-100', quantidade: 2, precoUnitario: 24.9 }],
    valorTotal: 49.8,
    criadoEm: '2026-09-30T19:20:00Z',
    formaPagamento: { tipo: 'pix', chave: '+5511900000000' },
  },
];

export function criarBase() {
  const pedidos: Pedido[] = structuredClone(SEMENTE);
  let proximo = 1006;
  return {
    listar: (status?: string) => (status ? pedidos.filter((p) => p.status === status) : pedidos),
    buscar: (id: string) => pedidos.find((p) => p.id === id),
    inserir: (dados: Omit<Pedido, 'id'>) => {
      const pedido = { id: `PED-${proximo++}`, ...dados };
      pedidos.push(pedido);
      return pedido;
    },
  };
}

export type Base = ReturnType<typeof criarBase>;
