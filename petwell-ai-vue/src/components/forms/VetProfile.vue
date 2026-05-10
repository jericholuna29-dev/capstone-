<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { supabase } from '@/lib/supabase'
import AppCard from '@/components/ui/AppCard.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppButton from '@/components/ui/AppButton.vue'

const VET_PROFILE_PHOTO_KEY_PREFIX = 'petwell_vet_profile_photo_v1_'

const toast = useToast()
const loading = ref(true)
const saving = ref(false)
const isEditing = ref(false)
const userId = ref<string | null>(null)
const profilePhoto = ref('')
const photoInputRef = ref<HTMLInputElement | null>(null)
const profile = ref({ fullName: '', email: '', phone: '', specializations: '', experience: '', clinic: '', address: '', licenseNumber: '' })

const triggerPhotoUpload = () => photoInputRef.value?.click()

const handlePhotoUpload = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return
  if (!file.type.startsWith('image/')) { toast.error('Please select a valid image file (JPG, PNG, etc.)'); return }
  if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return }
  const reader = new FileReader()
  reader.onload = () => { profilePhoto.value = String(reader.result) }
  reader.onerror = () => { toast.error('Failed to read image file. Please try again.') }
  reader.readAsDataURL(file)
  ;(e.target as HTMLInputElement).value = ''
}

const handleSave = async () => {
  saving.value = true
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) { toast.error('Please sign in to update profile'); saving.value = false; return }
  const vetExp = profile.value.experience.trim()
  const parsedExp = vetExp ? Number(vetExp) : null
  if (vetExp && Number.isNaN(parsedExp)) { toast.error('Years of experience must be a valid number'); saving.value = false; return }
  if (parsedExp !== null && parsedExp < 0) { toast.error('Years of experience cannot be negative'); saving.value = false; return }
  const { error: profileErr } = await supabase.from('profiles').update({ full_name: profile.value.fullName.trim() || null, phone: profile.value.phone.trim() || null, address: profile.value.address.trim() || null }).eq('id', authData.user.id)
  if (profileErr) { toast.error(profileErr.message || 'Failed to update profile'); saving.value = false; return }
  const { error: vetErr } = await supabase.from('vets').upsert({ id: authData.user.id, specialization: profile.value.specializations.trim() || null, experience_years: parsedExp, clinic_name: profile.value.clinic.trim() || null, clinic_address: profile.value.address.trim() || null, license_number: profile.value.licenseNumber.trim() || null }, { onConflict: 'id' })
  if (vetErr) { toast.error(vetErr.message || 'Failed to update veterinarian details'); saving.value = false; return }
  if (profilePhoto.value) window.localStorage.setItem(`${VET_PROFILE_PHOTO_KEY_PREFIX}${authData.user.id}`, profilePhoto.value)
  else window.localStorage.removeItem(`${VET_PROFILE_PHOTO_KEY_PREFIX}${authData.user.id}`)
  toast.success('Profile updated successfully!'); isEditing.value = false; saving.value = false
}

onMounted(async () => {
  loading.value = true
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) { toast.error('Please sign in to view profile'); loading.value = false; return }
  userId.value = authData.user.id
  const stored = window.localStorage.getItem(`${VET_PROFILE_PHOTO_KEY_PREFIX}${authData.user.id}`)
  if (stored) profilePhoto.value = stored
  const [{ data: profileData, error: profileError }, { data: vetData, error: vetError }] = await Promise.all([
    supabase.from('profiles').select('full_name, email, phone, address').eq('id', authData.user.id).single(),
    supabase.from('vets').select('specialization, experience_years, clinic_name, clinic_address, license_number').eq('id', authData.user.id).single(),
  ])
  if (profileError) toast.error(profileError.message || 'Failed to load profile information')
  if (vetError && vetError.code !== 'PGRST116') toast.error(vetError.message || 'Failed to load veterinarian details')
  profile.value = {
    fullName: profileData?.full_name || '', email: profileData?.email || authData.user.email || '',
    phone: profileData?.phone || '', specializations: vetData?.specialization || '',
    experience: typeof vetData?.experience_years === 'number' ? String(vetData.experience_years) : '',
    clinic: vetData?.clinic_name || '', address: vetData?.clinic_address || profileData?.address || '',
    licenseNumber: vetData?.license_number || '',
  }
  loading.value = false
})
</script>

<template>
  <div class="w-full max-w-2xl mx-auto px-3 sm:px-4 py-4 space-y-4 sm:space-y-6">
    <AppCard>
      <!-- Header: wraps on mobile -->
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4 sm:mb-6">
        <h2 class="text-2xl sm:text-3xl font-bold text-[#191D3A]">Veterinarian Profile</h2>
        <AppButton :variant="isEditing ? 'secondary' : 'primary'" @click="isEditing = !isEditing" class="text-sm sm:text-base">
          {{ isEditing ? 'Cancel' : 'Edit' }}
        </AppButton>
      </div>
      <div class="space-y-4">
        <p v-if="loading" class="pw-subtext">Loading veterinarian profile...</p>
        <template v-else>
          <!-- Avatar row: stacks vertically on mobile -->
          <div class="flex flex-col xs:flex-row items-center xs:items-start gap-4 mb-4 sm:mb-6">
            <!-- Clickable avatar (edit mode shows camera overlay) -->
            <div class="relative flex-shrink-0" :class="isEditing ? 'cursor-pointer group' : ''" @click="isEditing && triggerPhotoUpload()">
              <img v-if="profilePhoto" :src="profilePhoto" alt="Profile" class="w-20 h-20 rounded-full object-cover border-2 border-[#C9BEFF]" />
              <div v-else class="w-20 h-20 bg-gradient-to-br from-[#8494FF] to-[#6367FF] rounded-full flex items-center justify-center text-white text-lg font-bold">
                {{ profile.fullName.trim() ? profile.fullName.trim().slice(0, 2).toUpperCase() : 'VT' }}
              </div>
              <!-- Camera overlay shown in edit mode -->
              <div v-if="isEditing" class="absolute inset-0 rounded-full bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span class="text-white text-xs mt-1">Change</span>
              </div>
              <!-- Hidden real file input -->
              <input ref="photoInputRef" type="file" accept="image/jpeg,image/png,image/gif,image/webp" @change="handlePhotoUpload" class="hidden" />
            </div>
            <div class="text-center xs:text-left">
              <h3 class="text-xl sm:text-2xl font-bold text-[#191D3A]">{{ profile.fullName }}</h3>
              <p class="pw-subtext text-sm truncate">{{ profile.clinic }}</p>
              <div class="flex items-center justify-center xs:justify-start mt-2">
                <span class="text-[#6367FF]">★★★★★</span>
                <span class="pw-subtext text-sm ml-2">Vet Clinic Profile</span>
              </div>
              <p v-if="isEditing" class="text-xs text-[#8494FF] mt-1">Click avatar to change photo</p>
            </div>
          </div>
          <!-- Edit form -->
          <div v-if="isEditing" class="space-y-4">
            <AppInput label="Full Name" v-model="profile.fullName" />
            <AppInput label="Email" type="email" :model-value="profile.email" disabled />
            <AppInput label="Phone" v-model="profile.phone" />
            <AppInput label="Clinic Name" v-model="profile.clinic" />
            <!-- Two columns on sm+ -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AppInput label="Specializations" v-model="profile.specializations" />
              <AppInput label="License Number" v-model="profile.licenseNumber" />
              <AppInput label="Years of Experience" type="number" v-model="profile.experience" />
            </div>
            <AppInput label="Address" v-model="profile.address" />
            <AppButton variant="primary" class="w-full" :loading="saving" @click="handleSave">Save Changes</AppButton>
          </div>
          <!-- View mode -->
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <p class="text-xs sm:text-sm pw-subtext">Phone</p>
              <p class="text-base sm:text-lg font-semibold text-[#191D3A] break-words">{{ profile.phone || 'Not provided' }}</p>
            </div>
            <div>
              <p class="text-xs sm:text-sm pw-subtext">Consultation Fee</p>
              <p class="text-base sm:text-lg font-semibold text-[#191D3A]">Not provided</p>
            </div>
            <div>
              <p class="text-xs sm:text-sm pw-subtext">Years of Experience</p>
              <p class="text-base sm:text-lg font-semibold text-[#191D3A]">{{ profile.experience ? `${profile.experience} years` : 'Not provided' }}</p>
            </div>
            <div>
              <p class="text-xs sm:text-sm pw-subtext">Specializations</p>
              <p class="text-base sm:text-lg font-semibold text-[#191D3A] break-words">{{ profile.specializations || 'Not provided' }}</p>
            </div>
            <div class="sm:col-span-2">
              <p class="text-xs sm:text-sm pw-subtext">Clinic Address</p>
              <p class="text-base sm:text-lg text-[#191D3A] break-words">{{ profile.address || 'Not provided' }}</p>
            </div>
            <div class="sm:col-span-2">
              <p class="text-xs sm:text-sm pw-subtext">License Number</p>
              <p class="text-base sm:text-lg text-[#191D3A] break-words">{{ profile.licenseNumber || 'Not provided' }}</p>
            </div>
          </div>
        </template>
      </div>
    </AppCard>
  </div>
</template>
