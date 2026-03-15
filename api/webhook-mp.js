// /api/webhook-mp.js
// Recebe notificações do Mercado Pago
// Quando pagamento aprovado → ativa destaque no Supabase automaticamente
//
// Variáveis de ambiente necessárias:
//   MP_ACCESS_TOKEN          → token do Mercado Pago
//   SUPABASE_URL             → URL do projeto Supabase
//   SUPABASE_SERVICE_ROLE_KEY → service_role key (ignora RLS)

import { createClient } from '@supabase/supabase-js'

export const config = { api: { bodyParser: true } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN
  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { type, data } = req.body
  console.log('[Webhook] Recebido:', type, '| id:', data?.id)

  try {

    // ── PAGAMENTO ÚNICO APROVADO ──
    if (type === 'payment') {
      const payment = await mpGet(`/v1/payments/${data.id}`, ACCESS_TOKEN)
      console.log('[Webhook] Payment status:', payment.status)

      if (payment.status !== 'approved') {
        return res.json({ ok: true, msg: 'Pagamento não aprovado: ' + payment.status })
      }

      // Decodifica a referência externa
      let ref = {}
      try { ref = JSON.parse(payment.external_reference || '{}') } catch {}

      const { groupName, link, dias = 30, email } = ref

      if (!link) {
        console.warn('[Webhook] Sem link na referência externa')
        return res.json({ ok: true, msg: 'Sem link na referência' })
      }

      // Calcula data de expiração
      const featuredUntil = new Date(Date.now() + dias * 24 * 60 * 60 * 1000)

      // Busca o grupo pelo invite_link
      const { data: grupos, error: fetchErr } = await sb
        .from('groups')
        .select('id, name, is_featured')
        .eq('invite_link', link)
        .limit(1)

      if (fetchErr || !grupos?.length) {
        // Grupo não encontrado — registra o pagamento e cria log
        console.warn('[Webhook] Grupo não encontrado pelo link:', link)

        // Salva na tabela de pagamentos para o admin ver
        await sb.from('payments').insert({
          group_name: groupName,
          invite_link: link,
          payer_email: email,
          plan_type: ref.planType,
          amount: payment.transaction_amount,
          dias,
          mp_payment_id: payment.id.toString(),
          status: 'group_not_found',
          featured_until: featuredUntil.toISOString()
        }).then(() => {}).catch(() => {})

        return res.json({ ok: true, msg: 'Grupo não encontrado, pagamento registrado' })
      }

      const groupId = grupos[0].id

      // Ativa destaque no Supabase
      const { error: updateErr } = await sb.from('groups').update({
        is_featured: true,
        featured_until: featuredUntil.toISOString()
      }).eq('id', groupId)

      if (updateErr) {
        console.error('[Webhook] Erro ao ativar destaque:', updateErr.message)
        return res.status(500).json({ error: updateErr.message })
      }

      // Salva pagamento na tabela payments (para o admin)
      await sb.from('payments').insert({
        group_id: groupId,
        group_name: groupName,
        invite_link: link,
        payer_email: email,
        plan_type: ref.planType,
        amount: payment.transaction_amount,
        dias,
        mp_payment_id: payment.id.toString(),
        status: 'approved',
        featured_until: featuredUntil.toISOString()
      }).then(() => {}).catch(() => {})

      console.log(`[Webhook] ✅ Destaque ativado: ${grupos[0].name} até ${featuredUntil.toLocaleDateString('pt-BR')}`)
    }

  } catch (err) {
    console.error('[Webhook] Erro fatal:', err.message)
    return res.status(500).json({ error: err.message })
  }

  return res.json({ received: true })
}

async function mpGet(path, token) {
  const r = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return r.json()
}
