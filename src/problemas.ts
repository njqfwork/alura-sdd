import type { Response } from 'express';

// Erros de endpoints novos seguem a RFC 9457 (Problem Details for HTTP APIs).
// Os endpoints antigos mantêm o formato que os clientes já conhecem.

export function responderProblema(
  res: Response,
  status: number,
  tipo: string,
  titulo: string,
  detalhe: string,
  instancia: string,
) {
  res.status(status).type('application/problem+json').json({
    type: `https://api.techlog.example/problemas/${tipo}`,
    title: titulo,
    status,
    detail: detalhe,
    instance: instancia,
  });
}
