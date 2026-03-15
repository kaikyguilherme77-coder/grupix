// /api/create-payment.js
// Vercel Serverless Function — Mercado Pago
//
// PLANOS:
//   semana  → R$10 por 7 dias  (pagamento único)
//   quinzena → R$20 por 15 dias (pagamento único)
//   mensal  → R$25 por 30 dias (pagamento único)
//
// Variáveis de ambiente necessárias na Vercel:
//   MP_ACCESS_TOKEN  → seu token do Mercado Pago
//   SITE_URL         → https://grupix.site

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { groupName, email, link, planType } = req.body

  if (!groupName || !email || !planType || !link) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes' })
  }

  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN
  const SITE_URL     = process.env.SITE_URL || 'https://grupix.site'

  if (!ACCESS_TOKEN) {
    return res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado na Vercel' })
  }

  // ── CONFIG DOS PLANOS ──
  const PLANOS = {
    semana:   { dias: 7,  preco: 10.00, label: 'Destaque 7 dias'  },
    quinzena: { dias: 15, preco: 20.00, label: 'Destaque 15 dias' },
    mensal:   { dias: 30, preco: 25.00, label: 'Destaque 30 dias' },
  }

  const plano = PLANOS[planType]
  if (!plano) {
    return res.status(400).json({ error: `Plano inválido. Use: ${Object.keys(PLANOS).join(', ')}` })
  }

  // Referência externa com todos os dados necessários pro webhook
  const externalRef = JSON.stringify({
    groupName,
    link,
    planType,
    dias: plano.dias,
    email,
    ts: Date.now()
  })

  const body = {
    items: [{
      id: `grupix-${planType}`,
      title: `Grupix — ${plano.label}: ${groupName}`,
      description: `Seu grupo aparece no topo por ${plano.dias} dias`,
      quantity: 1,
      currency_id: 'BRL',
      unit_price: plano.preco
    }],
    payer: { email },
    external_reference: externalRef,
    back_urls: {
      success: `${SITE_URL}/?pagamento=sucesso&plano=${planType}&grupo=${encodeURIComponent(groupName)}`,
      failure: `${SITE_URL}/?pagamento=erro`,
      pending: `${SITE_URL}/?pagamento=pendente`
    },
    auto_return: 'approved',
    notification_url: `${SITE_URL}/api/webhook-mp`,
    statement_descriptor: 'GRUPIX',
    expires: false
  }

  try {
    const resp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      },
      body: JSON.stringify(body)
    })

    const data = await resp.json()

    if (!data.init_point) {
      console.error('[Grupix] Erro MP:', JSON.stringify(data))
      return res.status(500).json({
        error: 'Erro ao criar preferência de pagamento',
        detail: data.message || data
      })
    }

    console.log(`[Grupix] Preferência criada: ${data.id} | Plano: ${planType} | Grupo: ${groupName}`)
    return res.json({ url: data.init_point, preferenceId: data.id })

  } catch (err) {
    console.error('[Grupix] Erro fatal:', err.message)
    return res.status(500).json({ error: 'Erro interno', detail: err.message })
  }
}
