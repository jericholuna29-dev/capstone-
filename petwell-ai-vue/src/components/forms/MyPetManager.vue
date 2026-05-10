<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { supabase } from '@/lib/supabase'
import AppCard from '@/components/ui/AppCard.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppButton from '@/components/ui/AppButton.vue'

interface PetItem { id: string; name: string; species: string; breed: string | null; age: number | null; pet_image_url: string | null }

const toast = useToast()
const pets = ref<PetItem[]>([])
const loading = ref(true)
const saving = ref(false)
const form = ref({ name: '', species: 'dog', breed: '', age: '' })
const petImagePreview = ref<string | null>(null)

const ensureProfileExists = async (user: { id: string; email?: string | null }) => {
  const { data: existing, error: existingError } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (existingError) throw existingError
  if (existing) return
  const { error: createError } = await supabase.from('profiles').insert([{ id: user.id, email: user.email || `${user.id}@petwell.local`, role: 'pet_owner' }])
  if (createError) throw createError
}

const loadPets = async () => {
  loading.value = true
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) { loading.value = false; return }
  const { data, error } = await supabase.from('pets').select('id, name, species, breed, age, pet_image_url').eq('owner_id', authData.user.id).order('created_at', { ascending: false })
  if (error) { toast.error(error.message || 'Failed to load pets'); pets.value = [] }
  else pets.value = (data || []) as PetItem[]
  loading.value = false
}

const handlePetImageUpload = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) { petImagePreview.value = null; return }
  if (!file.type.startsWith('image/')) { toast.error('Please upload a valid image file'); return }
  if (file.size > 1.5 * 1024 * 1024) { toast.error('Image is too large. Please use an image below 1.5MB.'); return }
  const reader = new FileReader()
  reader.onload = () => { petImagePreview.value = String(reader.result) }
  reader.readAsDataURL(file)
}

const handleAddPet = async () => {
  if (!form.value.name.trim()) { toast.error('Pet name is required'); return }
  if (!form.value.species.trim()) { toast.error('Pet type is required'); return }
  saving.value = true
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) { toast.error('Please sign in to add a pet'); saving.value = false; return }
  const ageValue = form.value.age.trim() ? Number(form.value.age) : null
  if (ageValue !== null && (Number.isNaN(ageValue) || ageValue < 0)) { toast.error('Age must be a valid non-negative number'); saving.value = false; return }
  try { await ensureProfileExists({ id: authData.user.id, email: authData.user.email }) }
  catch (pe: any) { toast.error(pe?.message || 'Failed to prepare your profile'); saving.value = false; return }
  const { error } = await supabase.from('pets').insert([{ owner_id: authData.user.id, name: form.value.name.trim(), species: form.value.species.trim(), breed: form.value.breed.trim() || null, age: ageValue, pet_image_url: petImagePreview.value }])
  if (error) { toast.error(error.message || 'Failed to add pet'); saving.value = false; return }
  toast.success('Pet added successfully')
  form.value = { name: '', species: 'dog', breed: '', age: '' }; petImagePreview.value = null
  await loadPets(); saving.value = false
}

onMounted(() => { loadPets() })
</script>

<template>
  <div class="max-w-4xl mx-auto p-4 space-y-6">
    <AppCard class="bg-gradient-to-br from-[#FFDBFD] to-[#C9BEFF]/70">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-3xl font-bold text-[#191D3A]">My Pet</h2>
        <RouterLink to="/dashboard" class="text-sm font-semibold text-[#6367FF] hover:underline">Back to Dashboard</RouterLink>
      </div>
      <p class="text-[#32375D]">Manage your pet records and add a new pet profile.</p>
    </AppCard>
    <AppCard>
      <h3 class="text-xl font-bold text-[#191D3A] mb-4">Add a Pet</h3>
      <form @submit.prevent="handleAddPet" class="space-y-4">
        <AppInput label="Pet Name" v-model="form.name" placeholder="Enter pet name" />
        <div>
          <label class="block text-sm font-medium text-[#2B2F66] mb-2">Pet Type</label>
          <select v-model="form.species" class="w-full px-4 py-2 border border-[#C9BEFF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8494FF]">
            <option value="dog">Dog</option><option value="cat">Cat</option>
          </select>
        </div>
        <AppInput label="Breed (Optional)" v-model="form.breed" placeholder="Enter breed" />
        <AppInput label="Age (Optional)" type="number" min="0" v-model="form.age" placeholder="Enter age in years" />
        <div>
          <label class="block text-sm font-medium text-[#2B2F66] mb-2">Pet Profile Image (Optional)</label>
          <input type="file" accept="image/*" @change="handlePetImageUpload" class="w-full px-3 py-2 border border-[#C9BEFF] rounded-lg bg-white" />
          <img v-if="petImagePreview" :src="petImagePreview" alt="Pet profile preview" class="mt-3 h-20 w-20 rounded-full object-cover border border-[#C9BEFF]" />
        </div>
        <AppButton type="submit" variant="primary" :loading="saving">Add Pet</AppButton>
      </form>
    </AppCard>
    <AppCard>
      <h3 class="text-xl font-bold text-[#191D3A] mb-4">My Pets</h3>
      <p v-if="loading" class="pw-subtext">Loading pets...</p>
      <p v-else-if="pets.length === 0" class="pw-subtext">No pets added yet.</p>
      <div v-else class="space-y-3">
        <div v-for="pet in pets" :key="pet.id" class="border border-[#C9BEFF] rounded-lg bg-gradient-to-br from-[#FFDBFD]/70 to-[#C9BEFF]/40 p-4">
          <div class="flex items-center gap-3">
            <img v-if="pet.pet_image_url" :src="pet.pet_image_url" :alt="`${pet.name} profile`" class="h-14 w-14 rounded-full object-cover border border-[#C9BEFF]" />
            <div v-else class="h-14 w-14 rounded-full bg-gradient-to-br from-[#8494FF] to-[#6367FF] text-white text-sm font-bold flex items-center justify-center">{{ pet.name.slice(0, 2).toUpperCase() }}</div>
            <div>
              <p class="font-semibold text-[#191D3A]">{{ pet.name }}</p>
              <p class="text-sm text-[#32375D]">{{ [pet.species, pet.breed || null, pet.age !== null ? `${pet.age} years` : null].filter(Boolean).join(' | ') }}</p>
            </div>
          </div>
        </div>
      </div>
    </AppCard>
  </div>
</template>
