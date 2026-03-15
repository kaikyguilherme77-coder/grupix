// ============================================
// GRUPIX — config.js
// Supabase client + funções de autenticação
// ============================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// 🔧 SUBSTITUA PELOS SEUS DADOS DO SUPABASE
// Painel Supabase → Settings → API
const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co'
const SUPABASE_ANON_KEY = 'SUA-ANON-KEY-AQUI'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)


// ============================================
// AUTH — Cadastro
// ============================================
export async function signUp(email, password, username) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username } // salvo nos metadados
    }
  })

  if (error) throw error

  // Atualiza username no perfil público
  if (data.user) {
    await supabase
      .from('users')
      .update({ username })
      .eq('id', data.user.id)
  }

  return data
}


// ============================================
// AUTH — Login
// ============================================
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  if (error) throw error
  return data
}


// ============================================
// AUTH — Login com Google
// ============================================
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  })
  if (error) throw error
  return data
}


// ============================================
// AUTH — Logout
// ============================================
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}


// ============================================
// AUTH — Sessão atual
// ============================================
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Pega perfil completo da tabela users
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  return { ...user, profile }
}

// Listener de mudança de sessão
export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
}


// ============================================
// GRUPOS — Listagem
// ============================================
export async function getGroups({ category, search, featured } = {}) {
  let query = supabase
    .from('groups')
    .select('*')
    .order('is_featured', { ascending: false })
    .order('members', { ascending: false })

  if (category && category !== 'todos') {
    query = query.eq('category', category)
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
  }

  if (featured) {
    query = query.eq('is_featured', true)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}


// ============================================
// GRUPOS — Incrementar views
// ============================================
export async function incrementViews(groupId) {
  await supabase.rpc('increment_views', { group_id: groupId })
}


// ============================================
// SUBMISSÕES — Enviar novo grupo
// ============================================
export async function submitGroup({ name, description, category, platform, invite_link }) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login para enviar um grupo')

  const { data, error } = await supabase
    .from('group_submissions')
    .insert({
      name,
      description,
      category,
      platform,
      invite_link,
      user_id: user.id,
      status: 'pending'
    })
    .select()
    .single()

  if (error) throw error
  return data
}


// ============================================
// ADMIN — Listar submissões pendentes
// ============================================
export async function getPendingSubmissions() {
  const { data, error } = await supabase
    .from('group_submissions')
    .select('*, users(username, email)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}


// ============================================
// ADMIN — Aprovar submissão
// ============================================
export async function approveSubmission(submissionId) {
  // 1. Pega dados da submissão
  const { data: sub } = await supabase
    .from('group_submissions')
    .select('*')
    .eq('id', submissionId)
    .single()

  // 2. Cria na tabela groups
  const { error: insertError } = await supabase
    .from('groups')
    .insert({
      name: sub.name,
      description: sub.description,
      category: sub.category,
      platform: sub.platform,
      invite_link: sub.invite_link,
      submitted_by: sub.user_id
    })

  if (insertError) throw insertError

  // 3. Atualiza status da submissão
  const { error: updateError } = await supabase
    .from('group_submissions')
    .update({ status: 'approved' })
    .eq('id', submissionId)

  if (updateError) throw updateError
}


// ============================================
// ADMIN — Rejeitar submissão
// ============================================
export async function rejectSubmission(submissionId, reason = '') {
  const { error } = await supabase
    .from('group_submissions')
    .update({ status: 'rejected', rejection_reason: reason })
    .eq('id', submissionId)

  if (error) throw error
}
