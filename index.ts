// supabase/functions/create-pix-payment/index.ts
// ══════════════════════════════════════════════════
// Cria um PaymentIntent com método PIX via Stripe
// Implante com: supabase functions deploy create-pix-payment
// ══════════════════════════════════════════════════

import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Planos com valores em centavos (BRL)
const PLANOS: Record<string, { valor: number; dias: number; label: string }> = {
  basico: { valor: 1490, dias: 7,  label: 'Destaque Básico 7 dias' },
  vip:    { valor: 2490, dias: 15, label: 'Destaque PRO 15 dias' },
  boost:  { valor: 3990, dias: 30, label: 'Destaque VIP 30 dias' },
}

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }

  try {
    const { priceId, groupId, groupName, inviteLink, email, planType, dias } = await req.json()

    if (!email || !groupId || !planType) {
      return new Response(JSON.stringify({ error: 'Dados inválidos' }), { status: 400, headers })
    }

    const plano = PLANOS[planType]
    if (!plano) {
      return new Response(JSON.stringify({ error: 'Plano inválido' }), { status: 400, headers })
    }

    // Criar ou recuperar cliente Stripe
    const customers = await stripe.customers.list({ email, limit: 1 })
    let customer = customers.data[0]
    if (!customer) {
      customer = await stripe.customers.create({
        email,
        metadata: { grupix_group_id: groupId },
      })
    }

    // Criar PaymentIntent com PIX
    const paymentIntent = await stripe.paymentIntents.create({
      amount: plano.valor,
      currency: 'brl',
      customer: customer.id,
      payment_method_types: ['pix'],
      description: `${plano.label} — ${groupName}`,
      metadata: {
        group_id: groupId,
        group_name: groupName,
        invite_link: inviteLink,
        plan_type: planType,
        dias: String(plano.dias),
        email,
      },
    })

    // Extrair dados do QR Code PIX
    const pixData = paymentIntent.next_action?.pix_display_qr_code

    // Salvar pré-pagamento no banco
    await supabase.from('payments').insert({
      group_id: groupId,
      group_name: groupName,
      invite_link: inviteLink,
      payer_email: email,
      plan_type: planType,
      amount: plano.valor / 100,
      dias: plano.dias,
      mp_payment_id: paymentIntent.id, // reusando campo para stripe pi id
      status: 'pending',
      featured_until: null,
    })

    return new Response(JSON.stringify({
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      qrCode: pixData?.data || null,
      qrCodeImage: pixData?.image_url_png ? null : null, // Stripe retorna URL, não base64
      qrCodeImageUrl: pixData?.image_url_png || null,
      expiresAt: pixData?.expires_at || null,
    }), { headers })

  } catch (err: any) {
    console.error('Erro create-pix-payment:', err)
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }), { status: 500, headers })
  }
})
