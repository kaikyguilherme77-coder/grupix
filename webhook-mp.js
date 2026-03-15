// /api/webhook-mp.js
// Recebe notificações do Mercado Pago
// Ativa/desativa destaque no Supabase automaticamente

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // service role ignora RLS
)

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { type, data } = req.body

  try {
    // ========================================
    // PAGAMENTO ÚNICO aprovado
    // ========================================
    if (type === 'payment') {
      const payment = await fetchMP(`/v1/payments/${data.id}`)

      if (payment.status !== 'approved') return res.json({ ok: true })

      const groupId  = payment.metadata?.group_id
      const planType = payment.metadata?.plan_type

      if (!groupId) return res.json({ ok: true })

      // Boost = 7 dias, outros = 30 dias
      const dias = planType === 'boost' ? 7 : 30
      const featuredUntil = new Date(Date.now() + dias * 24 * 60 * 60 * 1000)

      await supabase.from('groups').update({
        is_featured: true,
        featured_until: featuredUntil.toISOString()
      }).eq('id', groupId)

      console.log(`✅ Grupo ${groupId} destacado até ${featuredUntil.toLocaleDateString('pt-BR')}`)
    }

    // ========================================
    // ASSINATURA — nova cobrança autorizada
    // ========================================
    if (type === 'subscription_preapproval') {
      const sub = await fetchMP(`/preapproval/${data.id}`)

      const groupId = sub.metadata?.group_id
      if (!groupId) return res.json({ ok: true })

      if (sub.status === 'authorized') {
        // Assinatura ativa — destaque por 30 dias
        const featuredUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

        await supabase.from('groups').update({
          is_featured: true,
          featured_until: featuredUntil.toISOString(),
          mp_subscription_id: sub.id
        }).eq('id', groupId)

        console.log(`✅ Assinatura ativa: grupo ${groupId}`)
      }

      if (sub.status === 'cancelled' || sub.status === 'paused') {
        // Assinatura cancelada — remove destaque
        await supabase.from('groups').update({
          is_featured: false,
          featured_until: null,
          mp_subscription_id: null
        }).eq('id', groupId)

        console.log(`❌ Assinatura cancelada: grupo ${groupId}`)
      }
    }

    // ========================================
    // COBRANÇA RECORRENTE paga
    // ========================================
    if (type === 'subscription_authorized_payment') {
      const invoicePayment = await fetchMP(`/authorized_payments/${data.id}`)

      if (invoicePayment.status !== 'approved') return res.json({ ok: true })

      // Renova mais 30 dias a partir de hoje
      const groupId = invoicePayment.metadata?.group_id
      if (!groupId) return res.json({ ok: true })

      const featuredUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      await supabase.from('groups').update({
        is_featured: true,
        featured_until: featuredUntil.toISOString()
      }).eq('id', groupId)

      console.log(`🔄 Renovado: grupo ${groupId}`)
    }

  } catch (err) {
    console.error('Webhook error:', err)
    return res.status(500).json({ error: err.message })
  }

  return res.json({ received: true })
}

// Helper para chamar a API do MP
async function fetchMP(path) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
  })
  return response.json()
}
