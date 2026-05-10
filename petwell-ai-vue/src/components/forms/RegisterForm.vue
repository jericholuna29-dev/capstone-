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
const fullName = ref('')
const role = ref<'pet_owner' | 'vet'>('pet_owner')
const phone = ref('')
const address = ref('')
const clinicName = ref('')
const clinicAddress = ref('')
const specialization = ref('')
const experienceYears = ref('')
const licenseNumber = ref('')
const loading = ref(false)
const errors = ref<Record<string, string>>({})
const lastAttempt = ref(0)
const retryAfter = ref(0)

const SIGNUP_COOLDOWN_MS = 60000

const validateForm = () => {
  const e: Record<string, string> = {}
  if (!email.value) e.email = 'Email is required'
  if (!fullName.value) e.fullName = 'Full name is required'
  if (!password.value) e.password = 'Password is required'
  if (password.value.length < 8) e.password = 'Password must be at least 8 characters'
  if (role.value === 'vet') {
    if (!phone.value.trim()) e.phone = 'Contact number is required for veterinarian registration'
    if (!address.value.trim()) e.address = 'Address is required for veterinarian registration'
    if (!clinicName.value.trim()) e.clinicName = 'Clinic name is required'
    if (!clinicAddress.value.trim()) e.clinicAddress = 'Clinic address is required for map recommendation'
    if (!specialization.value.trim()) e.specialization = 'Specialization is required'
  }
  errors.value = e
  return Object.keys(e).length === 0
}

const getSignupErrorMessage = (error: any) => {
  const raw = (error?.message || '').toLowerCase()
  if (error?.status === 429) return 'Too many registration attempts. Please wait and try again later.'
  if (error?.status === 409) return 'This account already exists. Please sign in instead.'
  if (error?.status === 422) {
    if (raw.includes('password')) return 'Password does not meet policy requirements. Use at least 8 characters.'
    if (raw.includes('signups not allowed')) return 'Signups are currently disabled in Supabase Auth settings.'
    return error?.message || 'Signup data is invalid.'
  }
  if (error?.status === 400) return error?.message || 'Invalid registration data.'
  return error?.message || 'Registration failed'
}

const handleSubmit = async () => {
  if (!validateForm()) return
  // Prevent concurrent submissions and quick retries (simple debounce)
  if (loading.value) return
  const now = Date.now()
  if (now < retryAfter.value) {
    const waitSeconds = Math.ceil((retryAfter.value - now) / 1000)
    toast.warning(`Please wait ${waitSeconds} seconds before trying again.`)
    return
  }
  if (now - lastAttempt.value < SIGNUP_COOLDOWN_MS) {
    toast.warning('Please wait a minute before trying again.')
    return
  }
  lastAttempt.value = now
  loading.value = true
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.value.trim().toLowerCase(),
      password: password.value,
      options: {
        data: {
          full_name: fullName.value.trim(),
          role: role.value,
          phone: phone.value.trim(),
          address: address.value.trim(),
          clinic_name: clinicName.value.trim(),
          clinic_address: clinicAddress.value.trim(),
          specialization: specialization.value.trim(),
          experience_years: experienceYears.value?.toString?.().trim?.() || '',
          license_number: licenseNumber.value.trim(),
        },
      },
    })
    if (authError) throw authError
    if (authData.user) {
      toast.success('Registration successful! Please check your email to confirm.')
      router.push('/auth/login')
    }
  } catch (error: any) {
    // If we detect a 429 from Supabase, provide a clearer message
    if (error?.status === 429) {
      retryAfter.value = Date.now() + SIGNUP_COOLDOWN_MS
      toast.error('Too many requests — please wait a moment and try again.')
    } else {
      toast.error(getSignupErrorMessage(error))
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <AppInput label="Full Name" type="text" v-model="fullName" :error="errors.fullName" placeholder="John Doe" />
    <AppInput label="Email" type="email" v-model="email" :error="errors.email" placeholder="you@example.com" />
    <AppInput label="Password" type="password" v-model="password" :error="errors.password" placeholder="••••••••" />

    <div>
      <label class="block text-sm font-medium text-[#32375D] mb-2">I am a:</label>
      <div class="flex gap-4">
        <label class="flex items-center">
          <input type="radio" value="pet_owner" v-model="role" class="mr-2" />
          <span class="text-[#32375D]">Pet Owner</span>
        </label>
        <label class="flex items-center">
          <input type="radio" value="vet" v-model="role" class="mr-2" />
          <span class="text-[#32375D]">Veterinarian</span>
        </label>
      </div>
    </div>

    <template v-if="role === 'vet'">
      <AppInput label="Contact Number" type="tel" v-model="phone" :error="errors.phone" placeholder="e.g. +63 912 345 6789" />
      <AppInput label="Address" type="text" v-model="address" :error="errors.address" placeholder="Your professional address" />
      <AppInput label="Clinic Name" type="text" v-model="clinicName" :error="errors.clinicName" placeholder="Petwell Veterinary Clinic" />
      <AppInput label="Clinic Address" type="text" v-model="clinicAddress" :error="errors.clinicAddress" placeholder="Clinic location for map recommendation" />
      <AppInput label="Specialization" type="text" v-model="specialization" :error="errors.specialization" placeholder="Small Animals, Surgery, Dermatology" />
      <AppInput label="Years of Experience (Optional)" type="number" min="0" v-model="experienceYears" placeholder="e.g. 5" />
      <AppInput label="License Number (Optional)" type="text" v-model="licenseNumber" placeholder="Professional license number" />
    </template>

    <AppButton type="submit" :loading="loading" variant="primary" size="md" class="w-full mt-6">
      Create Account
    </AppButton>
    <p class="text-center pw-subtext text-sm">
      Already have an account?
      <RouterLink to="/auth/login" class="text-[#6367FF] hover:underline font-semibold">Sign in</RouterLink>
    </p>
  </form>
</template>
