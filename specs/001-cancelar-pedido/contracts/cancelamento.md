# Contrato: POST /pedidos/{id}/cancelamento


## Requisição

Corpo opcional:

```json
{ "motivo": "Cliente desistiu da compra" }
```

`motivo`: texto opcional, até 200 caracteres.

## Respostas

| Status | Quando | Corpo |
| --- | --- | --- |
| 200 | Pedido cancelado, ou já estava cancelado | O pedido, com `status: "cancelado"`, `canceladoEm` e `motivoCancelamento` quando houver |
| 400 | Motivo inválido | Problem Details |
| 404 | Pedido não existe | Problem Details |
| 409 | Pedido enviado ou entregue | Problem Details, com `detail` explicando o motivo |
