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

  const TOKEN = process.env.MP_ACCESS_TOKEN
  const SITE  = process.env.SITE_URL || 'https://grupix.vercel.app'

  const PLANOS = {
    basico:   { dias: 30, preco: 19.00, label: 'Destaque Mensal'   },
    vip:      { dias: 30, preco: 49.00, label: 'VIP Mensal'        },
    boost:    { dias: 7,  preco: 14.00, label: 'Boost 7 dias'      },
    semana:   { dias: 7,  preco: 10.00, label: 'Destaque 7 dias'   },
    quinzena: { dias: 15, preco: 20.00, label: 'Destaque 15 dias'  },
    mensal:   { dias: 30, preco: 25.00, label: 'Destaque 30 dias'  },
  }

  const plano = PLANOS[planType]
  if (!plano) {
    return res.status(400).json({ error: 'Plano inválido: ' + planType })
  }

  const body = {
    items: [{
      title: 'Grupix — ' + plano.label + ': ' + groupName,
      quantity: 1,
      currency_id: 'BRL',
      unit_price: plano.preco
    }],
    payer: { email },
    external_reference: JSON.stringify({ groupName, link, planType, dias: plano.dias, email }),
    back_urls: {
      success: SITE + '/?pagamento=sucesso',
      failure: SITE + '/?pagamento=erro',
      pending: SITE + '/?pagamento=pendente'
    },
    auto_return: 'approved',
    notification_url: SITE + '/api/webhook-mp',
    statement_descriptor: 'GRUPIX'
  }

  try {
    const resp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + TOKEN
      },
      body: JSON.stringify(body)
    })

    const data = await resp.json()

    if (!data.init_point) {
      return res.status(500).json({ error: 'Erro MP', detail: data })
    }

    return res.json({ url: data.init_point })

  } catch (err) {
    return res.status(500).json({ error: 'Erro interno', detail: err.message })
  }
}
