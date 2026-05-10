<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import { supabase } from '@/lib/supabase'
import AppCard from '@/components/ui/AppCard.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppButton from '@/components/ui/AppButton.vue'

const CONSULTATION_HISTORY_KEY = 'petwell_consultation_history_v1'
const PROFILE_PHOTO_KEY_PREFIX = 'petwell_profile_photo_v1_'

interface ProfileState { fullName: string; email: string; phone: string; address: string; city: string; country: string; bio: string }
interface PetState { id?: string; name: string; type: string; age: string; imageUrl: string }
interface ConsultationResult { possible_illnesses: string[]; tips: string[]; recommendations: string[]; severity: 'low'|'medium'|'high' }
interface ConsultationHistoryEntry { id: string; createdAt: string; petName: string; petType: 'dog'|'cat'; petAge: number; symptoms: string; result: ConsultationResult }

const route = useRoute()
const toast = useToast()

const section = computed(() => route.query.section as string | undefined)
const consultationIdParam = computed(() => route.query.consultationId as string | undefined)

const loading = ref(true)
const saving = ref(false)
const userId = ref<string | null>(null)
const existingPetIds = ref<string[]>([])
const isEditing = ref(false)
const profile = ref<ProfileState>({ fullName: '', email: '', phone: '', address: '', city: '', country: '', bio: '' })
const pets = ref<PetState[]>([])
const profilePhoto = ref('')
const photoInputRef = ref<HTMLInputElement | null>(null)
const consultationHistory = ref<ConsultationHistoryEntry[]>([])
const selectedConsultationId = ref<string | null>(null)

const visibleProfileFields = computed(() => [
  { label: 'Phone', value: profile.value.phone },
  { label: 'Address', value: profile.value.address },
  { label: 'City', value: profile.value.city },
  { label: 'Country', value: profile.value.country },
  { label: 'Bio', value: profile.value.bio },
].filter(f => f.value.trim() !== ''))

const visiblePets = computed(() => pets.value.filter(p => p.name.trim() || p.type.trim() || p.age.trim()))

watch(consultationIdParam, (id) => { if (id) selectedConsultationId.value = id })

watch([section, () => consultationHistory.value.length], () => {
  if (section.value !== 'recent-consultations') return
  setTimeout(() => { document.getElementById('recent-consultations')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 300)
})

const updatePet = (idx: number, key: keyof PetState, value: string) => {
  pets.value = pets.value.map((p, i) => i === idx ? { ...p, [key]: value } : p)
}
const addPet = () => { pets.value = [...pets.value, { name: '', type: '', age: '', imageUrl: '' }] }
const removePet = (idx: number) => { pets.value = pets.value.filter((_, i) => i !== idx) }

const triggerPhotoUpload = () => photoInputRef.value?.click()

const handlePhotoUpload = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return
  if (!file.type.startsWith('image/')) { toast.error('Please select a valid image file (JPG, PNG, etc.)'); return }
  if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return }
  const reader = new FileReader()
  reader.onload = () => { profilePhoto.value = String(reader.result) }
  reader.onerror = () => { toast.error('Failed to read image file. Please try again.') }
  reader.readAsDataURL(file)
  // Reset input so the same file can be re-selected
  ;(e.target as HTMLInputElement).value = ''
}

const handlePetImageUpload = (idx: number, e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return
  if (!file.type.startsWith('image/')) { toast.error('Invalid image file'); return }
  if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return }
  const reader = new FileReader(); reader.onload = () => { updatePet(idx, 'imageUrl', String(reader.result || '')) }; reader.readAsDataURL(file)
}

const handleSave = async () => {
  if (!userId.value) { toast.error('Please sign in'); return }
  saving.value = true
  const { error: profileErr } = await supabase.from('profiles').update({ full_name: profile.value.fullName.trim() || null, phone: profile.value.phone.trim() || null, address: profile.value.address.trim() || null, city: profile.value.city.trim() || null, country: profile.value.country.trim() || null, bio: profile.value.bio.trim() || null }).eq('id', userId.value)
  if (profileErr) { toast.error(profileErr.message || 'Failed to update profile'); saving.value = false; return }
  if (profilePhoto.value) window.localStorage.setItem(`${PROFILE_PHOTO_KEY_PREFIX}${userId.value}`, profilePhoto.value)
  else window.localStorage.removeItem(`${PROFILE_PHOTO_KEY_PREFIX}${userId.value}`)
  const trimmedPets = pets.value.map(p => ({ ...p, name: p.name.trim(), type: p.type.trim().toLowerCase(), age: p.age.trim() })).filter(p => p.name || p.type || p.age || p.imageUrl)
  for (const pet of trimmedPets) {
    const parsedAge = pet.age ? Number(pet.age) : null
    if (pet.age && parsedAge !== null && (Number.isNaN(parsedAge) || parsedAge < 0)) { toast.error('Pet age must be a valid non-negative number'); saving.value = false; return }
    if (!pet.id && (!pet.name || !pet.type)) continue
    if (!pet.name) { toast.error('Each pet must have a name'); saving.value = false; return }
    if (!pet.type) { toast.error('Each pet must have a type'); saving.value = false; return }
    if (pet.id) {
      const { error } = await supabase.from('pets').update({ name: pet.name, species: pet.type, age: parsedAge, pet_image_url: pet.imageUrl || null }).eq('id', pet.id).eq('owner_id', userId.value)
      if (error) { toast.error(error.message || 'Failed to update pet'); saving.value = false; return }
    } else {
      const { error } = await supabase.from('pets').insert([{ owner_id: userId.value, name: pet.name, species: pet.type, age: parsedAge, pet_image_url: pet.imageUrl || null }])
      if (error) { toast.error(error.message || 'Failed to add pet'); saving.value = false; return }
    }
  }
  const currentIds = new Set(trimmedPets.map(p => p.id).filter(Boolean) as string[])
  const removedIds = existingPetIds.value.filter(id => !currentIds.has(id))
  if (removedIds.length) { await supabase.from('pets').delete().eq('owner_id', userId.value).in('id', removedIds) }
  const { data: refreshed } = await supabase.from('pets').select('id, name, species, age, pet_image_url').eq('owner_id', userId.value).order('created_at', { ascending: false })
  if (refreshed) {
    const norm = (refreshed as any[]).map(p => ({ id: p.id, name: p.name || '', type: p.species || '', age: p.age !== null ? String(p.age) : '', imageUrl: p.pet_image_url || '' }))
    pets.value = norm; existingPetIds.value = norm.map(p => p.id).filter(Boolean)
  }
  toast.success('Profile updated successfully!'); isEditing.value = false; saving.value = false
}

onMounted(async () => {
  try {
    const raw = window.localStorage.getItem(CONSULTATION_HISTORY_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ConsultationHistoryEntry[]
      if (Array.isArray(parsed)) { consultationHistory.value = parsed; if (parsed.length > 0) selectedConsultationId.value = parsed[0].id }
    }
  } catch { window.localStorage.removeItem(CONSULTATION_HISTORY_KEY) }
  if (consultationIdParam.value) selectedConsultationId.value = consultationIdParam.value
  loading.value = true
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const user = sessionData.session?.user
  if (sessionError || !user) { toast.error('Please sign in to view your profile'); loading.value = false; return }
  userId.value = user.id
  const stored = window.localStorage.getItem(`${PROFILE_PHOTO_KEY_PREFIX}${user.id}`)
  if (stored) profilePhoto.value = stored
  const [{ data: profileData, error: profileError }, { data: petsData, error: petsError }] = await Promise.all([
    supabase.from('profiles').select('full_name, email, phone, address, city, country, bio').eq('id', user.id).single(),
    supabase.from('pets').select('id, name, species, age, pet_image_url').eq('owner_id', user.id).order('created_at', { ascending: false }),
  ])
  if (profileError) toast.error(profileError.message || 'Failed to load profile details')
  else profile.value = { fullName: profileData?.full_name || '', email: profileData?.email || user.email || '', phone: profileData?.phone || '', address: profileData?.address || '', city: profileData?.city || '', country: profileData?.country || '', bio: profileData?.bio || '' }
  if (petsError) { toast.error(petsError.message || 'Failed to load pets'); pets.value = []; existingPetIds.value = [] }
  else {
    const loaded = ((petsData || []) as any[]).map(p => ({ id: p.id, name: p.name || '', type: p.species || '', age: p.age !== null ? String(p.age) : '', imageUrl: p.pet_image_url || '' }))
    pets.value = loaded; existingPetIds.value = loaded.map(p => p.id!).filter(Boolean)
  }
  loading.value = false
})
</script>

<template>
  <div class="w-full max-w-2xl mx-auto px-3 sm:px-4 py-4 space-y-4 sm:space-y-6">
    <AppCard>
      <!-- Header: title + edit button, wraps on mobile -->
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4 sm:mb-6">
        <h2 class="text-2xl sm:text-3xl font-bold text-[#191D3A]">My Profile</h2>
        <AppButton :variant="isEditing ? 'secondary' : 'primary'" @click="isEditing = !isEditing" class="text-sm sm:text-base">
          {{ isEditing ? 'Cancel' : 'Edit' }}
        </AppButton>
      </div>
      <div class="space-y-4">
        <p v-if="loading" class="pw-subtext">Loading profile...</p>
        <template v-else>
          <!-- Avatar row: stacks vertically on very small screens -->
          <div class="flex flex-col xs:flex-row items-center xs:items-start gap-4 mb-4 sm:mb-6">
            <!-- Clickable avatar (edit mode shows camera overlay) -->
            <div class="relative flex-shrink-0" :class="isEditing ? 'cursor-pointer group' : ''" @click="isEditing && triggerPhotoUpload()">
              <img v-if="profilePhoto" :src="profilePhoto" alt="Profile" class="w-20 h-20 rounded-full object-cover border-2 border-[#C9BEFF]" />
              <div v-else class="w-20 h-20 bg-gradient-to-br from-[#8494FF] to-[#6367FF] rounded-full flex items-center justify-center text-white text-lg font-bold">
                {{ profile.fullName.trim() ? profile.fullName.trim().slice(0, 2).toUpperCase() : 'NA' }}
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
              <h3 v-if="profile.fullName.trim()" class="text-xl sm:text-2xl font-bold text-[#191D3A]">{{ profile.fullName }}</h3>
              <p v-if="profile.email.trim()" class="pw-subtext text-sm break-all">{{ profile.email }}</p>
              <p v-if="isEditing" class="text-xs text-[#8494FF] mt-1">Click avatar to change photo</p>
            </div>
          </div>
          <!-- Edit form -->
          <div v-if="isEditing" class="space-y-4">
            <AppInput label="Full Name" v-model="profile.fullName" />
            <AppInput label="Email" type="email" :model-value="profile.email" disabled />
            <AppInput label="Phone" v-model="profile.phone" />
            <AppInput label="Address" v-model="profile.address" />
            <!-- City + Country side by side on sm+ -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AppInput label="City" v-model="profile.city" />
              <AppInput label="Country" v-model="profile.country" />
            </div>
            <div>
              <label class="block text-sm font-medium text-[#32375D] mb-2">Bio</label>
              <textarea v-model="profile.bio" class="w-full px-4 py-2 border border-[#C9BEFF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8494FF] text-sm" :rows="4" />
            </div>
            <AppButton variant="primary" class="w-full" :loading="saving" @click="handleSave">Save Changes</AppButton>
          </div>
          <!-- View mode -->
          <div v-else>
            <div v-if="visibleProfileFields.length > 0" class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div v-for="field in visibleProfileFields" :key="field.label" :class="field.label === 'Bio' ? 'sm:col-span-2' : ''">
                <p class="text-xs sm:text-sm pw-subtext">{{ field.label }}</p>
                <p class="text-base sm:text-lg font-semibold text-[#191D3A] break-words">{{ field.value }}</p>
              </div>
            </div>
            <p v-else class="text-[#5E6288]">No profile details added yet.</p>
          </div>
        </template>
      </div>
    </AppCard>

    <!-- My Pets -->
    <AppCard>
      <h3 class="text-xl sm:text-2xl font-bold text-[#191D3A] mb-4">My Pets</h3>
      <div v-if="isEditing" class="space-y-3">
        <div v-for="(pet, idx) in pets" :key="`${pet.name}-${idx}`" class="border rounded-lg p-3 sm:p-4 bg-gray-50 space-y-3">
          <div>
            <img v-if="pet.imageUrl" :src="pet.imageUrl" :alt="`${pet.name || 'Pet'} profile`" class="h-20 w-20 sm:h-24 sm:w-24 rounded-xl object-cover border border-[#C9BEFF]" />
            <div v-else class="h-20 w-20 sm:h-24 sm:w-24 rounded-xl bg-[#FFDBFD] border border-[#C9BEFF] flex items-center justify-center text-xs font-semibold text-[#5E6288]">No image</div>
          </div>
          <div>
            <label class="block text-sm font-medium text-[#32375D] mb-2">Pet Profile Image</label>
            <input type="file" accept="image/*" @change="e => handlePetImageUpload(idx, e)" class="w-full px-3 py-2 border border-[#C9BEFF] rounded-lg bg-white text-sm" />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AppInput label="Pet Name" :model-value="pet.name" @update:model-value="v => updatePet(idx, 'name', v)" />
            <AppInput label="Pet Type" :model-value="pet.type" @update:model-value="v => updatePet(idx, 'type', v)" />
            <AppInput label="Pet Age" type="number" min="0" :model-value="pet.age" @update:model-value="v => updatePet(idx, 'age', v)" />
          </div>
          <AppButton variant="danger" size="sm" @click="removePet(idx)">Remove Pet</AppButton>
        </div>
        <AppButton variant="secondary" @click="addPet">Add Pet</AppButton>
      </div>
      <div v-else class="space-y-3">
        <div v-if="visiblePets.length > 0">
          <div v-for="(pet, idx) in visiblePets" :key="`${pet.name}-${idx}`" class="border rounded-lg p-3 sm:p-4 bg-gray-50">
            <div class="flex items-center gap-3">
              <img v-if="pet.imageUrl" :src="pet.imageUrl" :alt="`${pet.name || 'Pet'} profile`" class="h-12 w-12 sm:h-14 sm:w-14 rounded-lg object-cover border border-[#C9BEFF] flex-shrink-0" />
              <div v-else class="h-12 w-12 sm:h-14 sm:w-14 rounded-lg bg-[#FFDBFD] border border-[#C9BEFF] flex items-center justify-center text-xs font-semibold text-[#5E6288] flex-shrink-0">Pet</div>
              <div class="min-w-0">
                <p class="font-semibold text-[#191D3A] truncate">{{ pet.name || 'Unnamed Pet' }}</p>
                <p v-if="pet.type || pet.age" class="text-sm pw-subtext truncate">{{ [pet.type && `Type: ${pet.type}`, pet.age && `Age: ${pet.age}`].filter(Boolean).join(' | ') }}</p>
              </div>
            </div>
          </div>
        </div>
        <p v-else class="text-[#5E6288]">No pets added yet.</p>
      </div>
    </AppCard>

    <!-- Recent Consultations -->
    <div id="recent-consultations">
      <AppCard>
        <h3 class="text-xl sm:text-2xl font-bold text-[#191D3A] mb-4">Recent Consultations</h3>
        <p v-if="consultationHistory.length === 0" class="text-[#5E6288]">No consultation history yet.</p>
        <div v-else class="space-y-2">
          <div v-for="entry in consultationHistory" :key="entry.id" :class="['rounded-lg border transition', selectedConsultationId === entry.id ? 'border-[#8494FF] bg-[#EDE9FF]' : 'border-[#C9BEFF] bg-white/70']">
            <button type="button" @click="selectedConsultationId = selectedConsultationId === entry.id ? null : entry.id" class="w-full px-3 sm:px-4 py-3 text-left">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="font-semibold text-[#191D3A] text-sm sm:text-base">{{ entry.petName }} ({{ entry.petType.toUpperCase() }})</p>
                  <p class="text-xs sm:text-sm text-[#32375D] mt-0.5">{{ new Date(entry.createdAt).toLocaleString() }}</p>
                  <p class="text-xs sm:text-sm text-[#32375D]">Severity: {{ entry.result.severity.toUpperCase() }}</p>
                  <p class="mt-1 line-clamp-2 text-xs sm:text-sm text-[#24274A]/80">Symptoms: {{ entry.symptoms }}</p>
                </div>
                <span class="text-xs font-semibold text-[#6367FF] whitespace-nowrap flex-shrink-0">
                  {{ selectedConsultationId === entry.id ? 'Hide' : 'Show' }}
                </span>
              </div>
            </button>
            <div v-if="selectedConsultationId === entry.id" class="border-t border-[#C9BEFF] px-3 sm:px-4 pb-4 pt-3">
              <h4 class="text-lg sm:text-xl font-bold text-[#191D3A] mb-1">Analysis Results</h4>
              <p class="text-xs sm:text-sm text-[#32375D] mb-3">{{ entry.petName }} • {{ new Date(entry.createdAt).toLocaleString() }}</p>
              <!-- Single column on mobile, 3 cols on md+ -->
              <div class="grid gap-3 grid-cols-1 md:grid-cols-3">
                <section class="rounded-lg border border-[#C9BEFF]/80 bg-white/80 p-3">
                  <h5 class="font-semibold text-[#24274A] mb-2 text-sm">Possible Illnesses</h5>
                  <ul class="space-y-1 text-xs sm:text-sm text-[#24274A]/85">
                    <li v-if="entry.result.possible_illnesses.length === 0">No possible illnesses identified.</li>
                    <li v-for="(ill, i) in entry.result.possible_illnesses" :key="i">• {{ ill }}</li>
                  </ul>
                </section>
                <section class="rounded-lg border border-[#C9BEFF]/80 bg-white/80 p-3">
                  <h5 class="font-semibold text-[#24274A] mb-2 text-sm">Care Tips</h5>
                  <ul class="space-y-1 text-xs sm:text-sm text-[#24274A]/85">
                    <li v-if="entry.result.tips.length === 0">No care tips available.</li>
                    <li v-for="(tip, i) in entry.result.tips" :key="i">• {{ tip }}</li>
                  </ul>
                </section>
                <section class="rounded-lg border border-[#C9BEFF]/80 bg-white/80 p-3">
                  <h5 class="font-semibold text-[#24274A] mb-2 text-sm">Recommendations</h5>
                  <ul class="space-y-1 text-xs sm:text-sm text-[#24274A]/85">
                    <li v-if="entry.result.recommendations.length === 0">No recommendations available.</li>
                    <li v-for="(rec, i) in entry.result.recommendations" :key="i">• {{ rec }}</li>
                  </ul>
                </section>
              </div>
            </div>
          </div>
        </div>
      </AppCard>
    </div>
  </div>
</template>
