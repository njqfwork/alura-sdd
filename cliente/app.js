// Cliente da TechLog API. Lista os pedidos e cancela os que ainda não saíram.
// Por padrão fala com a API no mesmo endereço da página.
// Para apontar para outro servidor, como o mock, use ?api=http://localhost:4010

const api = new URLSearchParams(location.search).get('api') ?? '';
document.getElementById('origem').textContent = `Dados de ${api || location.origin}`;

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const CANCELAVEIS = ['criado', 'pago'];

function acao(p) {
  if (p.status === 'cancelado') return `cancelado em ${data.format(new Date(p.canceladoEm))}`;
  if (CANCELAVEIS.includes(p.status)) return `<button data-cancelar="${p.id}">Cancelar</button>`;
  return '';
}

async function carregar() {
  const conteudo = document.getElementById('conteudo');
  try {
    const resposta = await fetch(`${api}/pedidos`);
    const pedidos = await resposta.json();
    const linhas = pedidos.map((p) => `
      <tr>
        <td>${p.id}</td>
        <td>${p.cliente}</td>
        <td><span class="selo ${p.status}">${p.status}</span></td>
        <td class="valor">${moeda.format(p.valor_total)}</td>
        <td>${p.forma_pagamento.tipo}</td>
        <td>${acao(p)}</td>
      </tr>`).join('');
    conteudo.innerHTML = `
      <table>
        <thead><tr><th>Pedido</th><th>Cliente</th><th>Status</th><th>Total</th><th>Pagamento</th><th></th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>`;
  } catch (erro) {
    conteudo.innerHTML = `<div class="erro">Não foi possível mostrar os pedidos: ${erro.message}</div>`;
  }
}

document.addEventListener('click', async (evento) => {
  const id = evento.target.dataset?.cancelar;
  if (!id) return;
  const resposta = await fetch(`${api}/pedidos/${id}/cancelamento`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ motivo: 'Cancelado pelo painel' }),
  });
  if (!resposta.ok) {
    const problema = await resposta.json();
    alert(problema.detail ?? 'Não foi possível cancelar.');
  }
  carregar();
});

carregar();
