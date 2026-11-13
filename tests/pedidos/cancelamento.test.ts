import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { criarApp } from '../../src/app.js';
import { criarBase } from '../../src/pedidos/dados.js';

// Sobe uma instância nova da API (com base nova) numa porta livre.
async function subirApp() {
  const servidor = criarApp().listen(0);
  await new Promise<void>((resolve) => servidor.once('listening', () => resolve()));
  const { port } = servidor.address() as AddressInfo;
  return {
    url: `http://localhost:${port}`,
    fechar: () => new Promise<void>((resolve) => servidor.close(() => resolve())),
  };
}

// Chama POST /pedidos/:id/cancelamento.
// corpo objeto → JSON; string → texto cru como JSON (para JSON malformado); undefined → sem corpo.
function cancelar(url: string, id: string, corpo?: unknown) {
  const init: RequestInit = { method: 'POST' };
  if (corpo !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
  }
  return fetch(`${url}/pedidos/${id}/cancelamento`, init);
}

// Executa fn com uma API nova e garante que ela é fechada no fim.
async function comApp(fn: (url: string) => Promise<void>) {
  const app = await subirApp();
  try {
    await fn(app.url);
  } finally {
    await app.fechar();
  }
}

const ehIsoValido = (valor: unknown) => typeof valor === 'string' && !Number.isNaN(Date.parse(valor));

describe('base: cancelar', () => {
  it('cancela um pedido criado sem motivo', () => {
    const base = criarBase();
    const r = base.cancelar('PED-1001');
    assert.equal(r.resultado, 'cancelado');
    assert.equal(r.pedido.status, 'cancelado');
    assert.ok(ehIsoValido(r.pedido.canceladoEm));
    assert.equal('motivoCancelamento' in r.pedido, false);
  });

  it('cancela um pedido pago com motivo, sem mexer no pagamento', () => {
    const base = criarBase();
    const antes = structuredClone(base.buscar('PED-1002')!);
    const r = base.cancelar('PED-1002', 'cliente desistiu');
    assert.equal(r.resultado, 'cancelado');
    const pedido = base.buscar('PED-1002')!;
    assert.equal(pedido.motivoCancelamento, 'cliente desistiu');
    assert.deepEqual(pedido.formaPagamento, antes.formaPagamento);
    assert.equal(pedido.valorTotal, antes.valorTotal);
    assert.deepEqual(pedido.itens, antes.itens);
  });

  it('repetir o cancelamento não muda data nem motivo', () => {
    const base = criarBase();
    base.cancelar('PED-1002', 'cliente desistiu');
    const primeiro = structuredClone(base.buscar('PED-1002')!);
    const r = base.cancelar('PED-1002', 'outro');
    assert.equal(r.resultado, 'ja-cancelado');
    assert.deepEqual(base.buscar('PED-1002'), primeiro);
  });
});

describe('POST /pedidos/:id/cancelamento: sucesso', () => {
  it('cancela PED-1001 sem corpo', () =>
    comApp(async (url) => {
      const res = await cancelar(url, 'PED-1001');
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') ?? '', /^application\/json/);
      const corpo = await res.json();
      assert.equal(corpo.status, 'cancelado');
      assert.ok(ehIsoValido(corpo.canceladoEm));
      assert.equal('motivoCancelamento' in corpo, false);
    }));

  it('cancela PED-1002 com motivo, consulta e repete sem mudar nada', () =>
    comApp(async (url) => {
      const antes = await (await fetch(`${url}/pedidos/PED-1002`)).json();

      const res = await cancelar(url, 'PED-1002', { motivo: 'cliente desistiu' });
      assert.equal(res.status, 200);
      const cancelado = await res.json();
      assert.equal(cancelado.status, 'cancelado');
      assert.equal(cancelado.motivoCancelamento, 'cliente desistiu');
      assert.ok(ehIsoValido(cancelado.canceladoEm));

      // FR-014: pagamento, valor e itens não mudam.
      assert.deepEqual(cancelado.forma_pagamento, antes.forma_pagamento);
      assert.equal(cancelado.valor_total, antes.valor_total);
      assert.deepEqual(cancelado.itens, antes.itens);

      // US1-3: a consulta mostra o pedido cancelado.
      const consultado = await (await fetch(`${url}/pedidos/PED-1002`)).json();
      assert.deepEqual(consultado, cancelado);

      // US1-4: repetir com outro motivo devolve o pedido como estava.
      const repetido = await cancelar(url, 'PED-1002', { motivo: 'outro' });
      assert.equal(repetido.status, 200);
      assert.deepEqual(await repetido.json(), cancelado);
    }));

  for (const motivo of ['   ', '', null]) {
    it(`motivo ${JSON.stringify(motivo)} conta como sem motivo`, () =>
      comApp(async (url) => {
        const res = await cancelar(url, 'PED-1005', { motivo });
        assert.equal(res.status, 200);
        const corpo = await res.json();
        assert.equal(corpo.status, 'cancelado');
        assert.equal('motivoCancelamento' in corpo, false);
      }));
  }

  it('remove os espaços das pontas do motivo', () =>
    comApp(async (url) => {
      const res = await cancelar(url, 'PED-1001', { motivo: '  cliente desistiu  ' });
      assert.equal(res.status, 200);
      assert.equal((await res.json()).motivoCancelamento, 'cliente desistiu');
    }));
});

describe('base: cancelar (recusas)', () => {
  it('não cancela pedido enviado', () => {
    const base = criarBase();
    const r = base.cancelar('PED-1003');
    assert.equal(r.resultado, 'nao-cancelavel');
    const pedido = base.buscar('PED-1003')!;
    assert.equal(pedido.status, 'enviado');
    assert.equal('canceladoEm' in pedido, false);
  });

  it('não cancela pedido entregue', () => {
    const base = criarBase();
    assert.equal(base.cancelar('PED-1004').resultado, 'nao-cancelavel');
    assert.equal(base.buscar('PED-1004')!.status, 'entregue');
  });

  it('pedido inexistente', () => {
    assert.deepEqual(criarBase().cancelar('PED-9999'), { resultado: 'nao-encontrado' });
  });
});

const PROBLEMAS = 'https://techlog.example/problemas';

async function conferirProblema(res: Response, esperado: Record<string, unknown>) {
  assert.equal(res.status, esperado.status);
  assert.match(res.headers.get('content-type') ?? '', /^application\/problem\+json/);
  assert.deepEqual(await res.json(), esperado);
}

describe('POST /pedidos/:id/cancelamento: recusas', () => {
  it('pedido enviado → 409 e o pedido não muda', () =>
    comApp(async (url) => {
      await conferirProblema(await cancelar(url, 'PED-1003'), {
        type: `${PROBLEMAS}/pedido-nao-cancelavel`,
        title: 'Pedido não pode ser cancelado',
        status: 409,
        detail: 'Pedidos já enviados não podem ser cancelados. Status atual: enviado.',
        instance: '/pedidos/PED-1003/cancelamento',
        pedidoId: 'PED-1003',
        statusAtual: 'enviado',
      });
      const pedido = await (await fetch(`${url}/pedidos/PED-1003`)).json();
      assert.equal(pedido.status, 'enviado');
      assert.equal('canceladoEm' in pedido, false);
    }));

  it('pedido entregue → 409 e o pedido não muda', () =>
    comApp(async (url) => {
      await conferirProblema(await cancelar(url, 'PED-1004', { motivo: 'cliente desistiu' }), {
        type: `${PROBLEMAS}/pedido-nao-cancelavel`,
        title: 'Pedido não pode ser cancelado',
        status: 409,
        detail: 'Pedidos já entregues não podem ser cancelados. Status atual: entregue.',
        instance: '/pedidos/PED-1004/cancelamento',
        pedidoId: 'PED-1004',
        statusAtual: 'entregue',
      });
      assert.equal((await (await fetch(`${url}/pedidos/PED-1004`)).json()).status, 'entregue');
    }));

  it('pedido inexistente → 404', () =>
    comApp(async (url) => {
      await conferirProblema(await cancelar(url, 'PED-9999'), {
        type: `${PROBLEMAS}/pedido-nao-encontrado`,
        title: 'Pedido não encontrado',
        status: 404,
        detail: 'Não existe pedido com o id PED-9999.',
        instance: '/pedidos/PED-9999/cancelamento',
        pedidoId: 'PED-9999',
      });
    }));

  it('motivo com 501 caracteres → 400 e o pedido não muda', () =>
    comApp(async (url) => {
      await conferirProblema(await cancelar(url, 'PED-1005', { motivo: 'a'.repeat(501) }), {
        type: `${PROBLEMAS}/motivo-muito-longo`,
        title: 'Motivo muito longo',
        status: 400,
        detail: 'O motivo pode ter no máximo 500 caracteres; foram enviados 501.',
        instance: '/pedidos/PED-1005/cancelamento',
        limite: 500,
        tamanho: 501,
      });
      assert.equal((await (await fetch(`${url}/pedidos/PED-1005`)).json()).status, 'pago');
    }));

  const motivosNoLimite: [string, string][] = [
    ['500 caracteres', 'a'.repeat(500)],
    ['500 emojis (1000 unidades UTF-16)', '😀'.repeat(500)],
    ['500 caracteres com espaços nas pontas', ' '.repeat(10) + 'a'.repeat(500) + ' '.repeat(10)],
  ];
  for (const [nome, motivo] of motivosNoLimite) {
    it(`aceita motivo com ${nome}`, () =>
      comApp(async (url) => {
        const res = await cancelar(url, 'PED-1005', { motivo });
        assert.equal(res.status, 200);
        assert.equal((await res.json()).motivoCancelamento, motivo.trim());
      }));
  }

  it('motivo que não é texto → 400', () =>
    comApp(async (url) => {
      await conferirProblema(await cancelar(url, 'PED-1005', { motivo: 123 }), {
        type: `${PROBLEMAS}/requisicao-invalida`,
        title: 'Requisição inválida',
        status: 400,
        detail: 'O campo motivo, quando informado, deve ser um texto.',
        instance: '/pedidos/PED-1005/cancelamento',
      });
    }));

  it('corpo que não é objeto → 400', () =>
    comApp(async (url) => {
      await conferirProblema(await cancelar(url, 'PED-1005', []), {
        type: `${PROBLEMAS}/requisicao-invalida`,
        title: 'Requisição inválida',
        status: 400,
        detail: 'O corpo, quando informado, deve ser um objeto JSON.',
        instance: '/pedidos/PED-1005/cancelamento',
      });
    }));

  it('JSON malformado → 400 em Problem Details', () =>
    comApp(async (url) => {
      await conferirProblema(await cancelar(url, 'PED-1005', '{"motivo":'), {
        type: `${PROBLEMAS}/requisicao-invalida`,
        title: 'Requisição inválida',
        status: 400,
        detail: 'O corpo da requisição não é um JSON válido.',
        instance: '/pedidos/PED-1005/cancelamento',
      });
      assert.equal((await (await fetch(`${url}/pedidos/PED-1005`)).json()).status, 'pago');
    }));

  it('valida o corpo antes do estado: pedido já cancelado + motivo longo → 400', () =>
    comApp(async (url) => {
      assert.equal((await cancelar(url, 'PED-1002')).status, 200);
      const res = await cancelar(url, 'PED-1002', { motivo: 'a'.repeat(501) });
      assert.equal(res.status, 400);
      assert.equal((await res.json()).type, `${PROBLEMAS}/motivo-muito-longo`);
    }));

  it('valida o corpo antes da existência: pedido inexistente + motivo inválido → 400', () =>
    comApp(async (url) => {
      const res = await cancelar(url, 'PED-9999', { motivo: 123 });
      assert.equal(res.status, 400);
      assert.equal((await res.json()).type, `${PROBLEMAS}/requisicao-invalida`);
    }));

  it('corpo acima do limite do express.json() → 413 em Problem Details', () =>
    comApp(async (url) => {
      await conferirProblema(await cancelar(url, 'PED-1005', { motivo: 'a'.repeat(200_000) }), {
        type: `${PROBLEMAS}/requisicao-invalida`,
        title: 'Requisição inválida',
        status: 413,
        detail: 'O corpo da requisição é grande demais.',
        instance: '/pedidos/PED-1005/cancelamento',
      });
      assert.equal((await (await fetch(`${url}/pedidos/PED-1005`)).json()).status, 'pago');
    }));

  it('charset não suportado → 415 em Problem Details', () =>
    comApp(async (url) => {
      const res = await fetch(`${url}/pedidos/PED-1005/cancelamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=latin9' },
        body: '{}',
      });
      await conferirProblema(res, {
        type: `${PROBLEMAS}/requisicao-invalida`,
        title: 'Requisição inválida',
        status: 415,
        detail: 'O corpo da requisição não pôde ser lido.',
        instance: '/pedidos/PED-1005/cancelamento',
      });
    }));

  it('corpo que não é JSON → 400 e o pedido não muda', () =>
    comApp(async (url) => {
      const res = await fetch(`${url}/pedidos/PED-1001/cancelamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'cliente desistiu',
      });
      await conferirProblema(res, {
        type: `${PROBLEMAS}/requisicao-invalida`,
        title: 'Requisição inválida',
        status: 400,
        detail: 'O corpo, quando informado, deve ser JSON (Content-Type: application/json).',
        instance: '/pedidos/PED-1001/cancelamento',
      });
      assert.equal((await (await fetch(`${url}/pedidos/PED-1001`)).json()).status, 'criado');
    }));
});

describe('concorrência', () => {
  it('duas tentativas simultâneas: as duas são aceitas e o pedido fica com os dados da primeira', () =>
    comApp(async (url) => {
      const respostas = await Promise.all([
        cancelar(url, 'PED-1002', { motivo: 'm1' }),
        cancelar(url, 'PED-1002', { motivo: 'm2' }),
      ]);
      for (const r of respostas) assert.equal(r.status, 200);
      const [a, b] = await Promise.all(respostas.map((r) => r.json()));
      assert.deepEqual(a, b);
      assert.deepEqual(await (await fetch(`${url}/pedidos/PED-1002`)).json(), a);
      assert.ok(['m1', 'm2'].includes(a.motivoCancelamento));
    }));
});

describe('erros dos endpoints existentes não mudam', () => {
  it('GET /pedidos/:id inexistente mantém { erro }', () =>
    comApp(async (url) => {
      const res = await fetch(`${url}/pedidos/PED-9999`);
      assert.equal(res.status, 404);
      assert.doesNotMatch(res.headers.get('content-type') ?? '', /problem\+json/);
      assert.deepEqual(await res.json(), { erro: 'Pedido não encontrado' });
    }));

  it('POST /pedidos sem cliente mantém { message, code }', () =>
    comApp(async (url) => {
      const res = await fetch(`${url}/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      assert.equal(res.status, 400);
      assert.deepEqual(await res.json(), { message: 'cliente é obrigatório', code: 'VALIDACAO' });
    }));

  it('POST /pedidos com JSON malformado não vira Problem Details', () =>
    comApp(async (url) => {
      const res = await fetch(`${url}/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"cliente":',
      });
      assert.equal(res.status, 400);
      assert.doesNotMatch(res.headers.get('content-type') ?? '', /problem\+json/);
    }));
});

describe('listagem com cancelados', () => {
  it('lista e filtra pedidos cancelados; os demais ficam sem os campos novos', () =>
    comApp(async (url) => {
      assert.deepEqual(await (await fetch(`${url}/pedidos?status=cancelado`)).json(), []);

      assert.equal((await cancelar(url, 'PED-1001')).status, 200);
      assert.equal((await cancelar(url, 'PED-1002', { motivo: 'cliente desistiu' })).status, 200);

      const todos: any[] = await (await fetch(`${url}/pedidos`)).json();
      assert.equal(todos.length, 5);
      const porId = Object.fromEntries(todos.map((p) => [p.id, p]));
      for (const id of ['PED-1001', 'PED-1002']) {
        assert.equal(porId[id].status, 'cancelado');
        assert.ok(ehIsoValido(porId[id].canceladoEm));
      }
      assert.equal('motivoCancelamento' in porId['PED-1001'], false);
      assert.equal(porId['PED-1002'].motivoCancelamento, 'cliente desistiu');
      for (const id of ['PED-1003', 'PED-1004', 'PED-1005']) {
        assert.equal('canceladoEm' in porId[id], false);
        assert.equal('motivoCancelamento' in porId[id], false);
      }

      const cancelados: any[] = await (await fetch(`${url}/pedidos?status=cancelado`)).json();
      assert.deepEqual(cancelados.map((p) => p.id).sort(), ['PED-1001', 'PED-1002']);
    }));

  it('pedidos não cancelados mantêm exatamente o formato de antes', () =>
    comApp(async (url) => {
      assert.deepEqual(await (await fetch(`${url}/pedidos/PED-1003`)).json(), {
        id: 'PED-1003',
        cliente: 'Carla Mendes',
        status: 'enviado',
        valor_total: 89.9,
        criadoEm: '2026-09-25T16:05:00Z',
        forma_pagamento: {
          tipo: 'boleto',
          linha_digitavel: '34191.79001 01043.510047 91020.150008 1 10010000008990',
          vencimento: '2026-10-02',
        },
        itens: [{ sku: 'CX-GDE', quantidade: 1, preco_unitario: 89.9 }],
      });
      assert.deepEqual(await (await fetch(`${url}/pedidos/PED-1002`)).json(), {
        id: 'PED-1002',
        cliente: 'Bruno Lima',
        status: 'pago',
        valor_total: 97.4,
        criadoEm: '2026-09-29T08:40:00Z',
        forma_pagamento: { tipo: 'cartao', bandeira: 'visa', parcelas: 2, final_cartao: '4242' },
        itens: [
          { sku: 'CX-MED', quantidade: 1, preco_unitario: 59.9 },
          { sku: 'FITA-50', quantidade: 3, preco_unitario: 12.5 },
        ],
      });
    }));
});
