// /api/create-payment.js
// Cria preferência de pagamento no Mercado Pago
// Suporta pagamento único E assinatura recorrente

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { groupId, planType, groupName, email } = req.body

  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN

  // ========================================
  // PLANO ÚNICO — boost 7 dias (R$15)
  // ========================================
  if (planType === 'boost') {
    const preference = {
      items: [{
        title: `Grupix — Destaque 7 dias: ${groupName}`,
        quantity: 1,
        unit_price: 15.00,
        currency_id: 'BRL'
      }],
      payer: { email },
      metadata: { group_id: groupId, plan_type: 'boost' },
      back_urls: {
        success: `${process.env.SITE_URL}/sucesso?grupo=${groupId}&plano=boost`,
        failure: `${process.env.SITE_URL}/?erro=pagamento`,
        pending: `${process.env.SITE_URL}/pendente?grupo=${groupId}`
      },
      auto_return: 'approved',
      notification_url: `${process.env.SITE_URL}/api/webhook-mp`,
      statement_descriptor: 'GRUPIX'
    }

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      },
      body: JSON.stringify(preference)
    })

    const data = await response.json()
    return res.json({ url: data.init_point, id: data.id })
  }

  // ========================================
  // ASSINATURA RECORRENTE — básico R$20 ou VIP R$50
  // ========================================
  const precos = { basico: 20.00, vip: 50.00 }
  const nomes  = { basico: 'Destaque Básico', vip: 'VIP — Topo Fixo + Badge' }

  const subscription = {
    reason: `Grupix ${nomes[planType]}: ${groupName}`,
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: precos[planType],
      currency_id: 'BRL'
    },
    payer_email: email,
    back_url: `${process.env.SITE_URL}/sucesso?grupo=${groupId}&plano=${planType}`,
    notification_url: `${process.env.SITE_URL}/api/webhook-mp`,
    metadata: { group_id: groupId, plan_type: planType },
    status: 'authorized'
  }

  const response = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ACCESS_TOKEN}`
    },
    body: JSON.stringify(subscription)
  })

  const data = await response.json()
  return res.json({ url: data.init_point, id: data.id })
}
