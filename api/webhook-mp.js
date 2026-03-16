import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { type, data } = req.body

  try {
    if (type === 'payment') {
      const payment = await mpGet('/v1/payments/' + data.id)
      if (payment.status !== 'approved') return res.json({ ok: true })

      let ref = {}
      try { ref = JSON.parse(payment.external_reference || '{}') } catch {}

      const { groupName, link, dias = 30, email, planType } = ref
      if (!link) return res.json({ ok: true })

      const featuredUntil = new Date(Date.now() + dias * 24 * 60 * 60 * 1000)

      const { data: grupos } = await sb
        .from('groups').select('id').eq('invite_link', link).limit(1)

      if (grupos && grupos.length) {
        await sb.from('groups').update({
          is_featured: true,
          featured_until: featuredUntil.toISOString()
        }).eq('id', grupos[0].id)

        // Salva no histórico
        await sb.from('payments').insert({
          group_id: grupos[0].id,
          group_name: groupName,
          invite_link: link,
          payer_email: email,
          plan_type: planType,
          amount: payment.transaction_amount,
          dias,
          mp_payment_id: String(payment.id),
          status: 'approved',
          featured_until: featuredUntil.toISOString()
        }).then(()=>{}).catch(()=>{})
      }
    }
  } catch (err) {
    console.error('Webhook erro:', err.message)
    return res.status(500).json({ error: err.message })
  }

  return res.json({ received: true })
}

async function mpGet(path) {
  const r = await fetch('https://api.mercadopago.com' + path, {
    headers: { 'Authorization': 'Bearer ' + process.env.MP_ACCESS_TOKEN }
  })
  return r.json()
}
