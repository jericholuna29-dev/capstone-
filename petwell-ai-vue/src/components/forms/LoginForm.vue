<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useToast } from 'vue-toastification'
import AppInput from '@/components/ui/AppInput.vue'
import AppButton from '@/components/ui/AppButton.vue'

const router = useRouter()
const toast = useToast()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errors = ref<Record<string, string>>({})

const validateForm = () => {
  const e: Record<string, string> = {}
  if (!email.value) e.email = 'Email is required'
  if (!password.value) e.password = 'Password is required'
  errors.value = e
  return Object.keys(e).length === 0
}

const getLoginErrorMessage = (error: any) => {
  const raw = (error?.message || '').toLowerCase()
  if (error?.status === 429) return 'Too many login attempts. Please wait a few minutes and try again.'
  if (raw.includes('email not confirmed')) return 'Email not confirmed yet. Please check your inbox and verify your account.'
  if (error?.status === 400) {
    if (raw.includes('invalid login credentials')) return 'Invalid email or password.'
    return error?.message || 'Login request was rejected.'
  }
  return error?.message || 'Login failed'
}

const handleSubmit = async () => {
  if (!validateForm()) return
  loading.value = true
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value.trim().toLowerCase(),
      password: password.value,
    })
    if (error) throw error
    toast.success('Login successful!')
    router.push('/dashboard')
  } catch (error: any) {
    toast.error(getLoginErrorMessage(error))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <AppInput label="Email" type="email" v-model="email" :error="errors.email" placeholder="you@example.com" />
    <AppInput label="Password" type="password" v-model="password" :error="errors.password" placeholder="••••••••" />
    <AppButton type="submit" :loading="loading" variant="primary" size="md" class="w-full mt-6">
      Sign In
    </AppButton>
    <p class="text-center pw-subtext text-sm">
      Don't have an account?
      <RouterLink to="/auth/register" class="text-[#6367FF] hover:underline font-semibold">Sign up</RouterLink>
    </p>
  </form>
</template>
