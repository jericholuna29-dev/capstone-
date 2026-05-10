<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import { supabase } from '@/lib/supabase'
import AppCard from '@/components/ui/AppCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'

interface ConsultationResponse { possible_illnesses: string[]; tips: string[]; recommendations: string[]; severity: 'low' | 'medium' | 'high' }
interface VetProfileRow { id: string; full_name: string | null; email: string; phone: string | null; address: string | null }
interface VetDetailsRow { id: string; clinic_name: string | null; clinic_address: string | null; specialization: string | null; experience_years: number | null }
interface RecommendedVet { id: string; name: string; email: string; phone: string; address: string; clinicName: string; clinicAddress: string; specialization: string; experienceYears: string }
interface ConsultationHistoryEntry { id: string; createdAt: string; petName: string; petType: 'dog' | 'cat'; petAge: number; symptoms: string; result: ConsultationResponse }
interface PetOption { id: string; name: string; species: string; age: number | null }

const CONSULTATION_HISTORY_KEY = 'petwell_consultation_history_v1'
const CONSULTATION_BOOKING_PREFILL_KEY = 'petwell_consultation_booking_prefill_v1'

const router = useRouter()
const toast = useToast()

const petName = ref('')
const selectedPetId = ref('')
const petOptions = ref<PetOption[]>([])
const loadingPets = ref(false)
const petType = ref<'dog' | 'cat'>('dog')
const petAge = ref('')
const symptoms = ref('')
const loading = ref(false)
const result = ref<ConsultationResponse | null>(null)
const recommendedVets = ref<RecommendedVet[]>([])
const loadingVets = ref(false)
const errors = ref<Record<string, string>>({})
const consultationHistory = ref<ConsultationHistoryEntry[]>([])

// ── Symptom suggestions ──────────────────────────────────────────────────────
const selectedSymptomCategory = ref<string>('Common')

const symptomSuggestions: Record<string, Record<string, string[]>> = {
  dog: {
    Common:    ['Vomiting', 'Diarrhea', 'Loss of appetite', 'Lethargy', 'Excessive thirst', 'Weight loss'],
    Digestive: ['Bloated abdomen', 'Constipation', 'Blood in stool', 'Excessive gas', 'Drooling excessively', 'Lip-licking'],
    Skin:      ['Itching / scratching', 'Hair loss (alopecia)', 'Red or inflamed skin', 'Dry/flaky skin', 'Hot spots', 'Rashes or bumps'],
    Breathing: ['Coughing', 'Sneezing', 'Labored breathing', 'Wheezing', 'Nasal discharge', 'Reverse sneezing'],
    Mobility:  ['Limping', 'Stiff joints', 'Reluctant to move', 'Trembling or shaking', 'Sudden collapse', 'Muscle weakness'],
    Eyes:      ['Red eyes', 'Cloudy eyes', 'Eye discharge', 'Squinting', 'Swollen eyelid', 'Pawing at eyes'],
    Ears:      ['Head shaking', 'Ear discharge', 'Foul ear odor', 'Scratching at ears', 'Tilting head'],
    Behavior:  ['Aggression', 'Anxiety / restlessness', 'Excessive barking', 'Confusion / disorientation', 'Hiding', 'Excessive panting'],
    Urinary:   ['Frequent urination', 'Straining to urinate', 'Blood in urine', 'Accidents indoors', 'Foul-smelling urine'],
  },
  cat: {
    Common:    ['Vomiting', 'Diarrhea', 'Loss of appetite', 'Lethargy', 'Excessive thirst', 'Weight loss'],
    Digestive: ['Constipation', 'Blood in stool', 'Hairballs', 'Bloated abdomen', 'Excessive drooling'],
    Skin:      ['Overgrooming', 'Hair loss', 'Dry or flaky skin', 'Scabby or crusty patches', 'Itching / scratching', 'Ringworm patches'],
    Breathing: ['Coughing', 'Sneezing', 'Labored breathing', 'Wheezing', 'Nasal discharge', 'Open-mouth breathing'],
    Mobility:  ['Limping', 'Reluctant to jump', 'Stiff joints', 'Trembling', 'Sudden collapse'],
    Eyes:      ['Red eyes', 'Cloudy eyes', 'Eye discharge', 'Third eyelid visible', 'Squinting', 'Pawing at eyes'],
    Ears:      ['Head shaking', 'Ear discharge', 'Dark debris in ears', 'Scratching at ears', 'Foul ear odor'],
    Behavior:  ['Hiding', 'Aggression', 'Crying/yowling excessively', 'Confusion', 'Increased clinginess', 'Litter box avoidance'],
    Urinary:   ['Straining to urinate', 'Frequent urination', 'Blood in urine', 'Urinating outside litter box', 'Crying when urinating'],
  },
}

const symptomCategories = computed(() => Object.keys(symptomSuggestions[petType.value] || symptomSuggestions.dog))

const currentSuggestions = computed(() => {
  const map = symptomSuggestions[petType.value] || symptomSuggestions.dog
  return map[selectedSymptomCategory.value] || []
})

const addedSymptoms = computed<Set<string>>(() => {
  const lower = symptoms.value.toLowerCase()
  const all = Object.values(symptomSuggestions[petType.value] || symptomSuggestions.dog).flat()
  return new Set(all.filter(s => lower.includes(s.toLowerCase())))
})

const addSymptom = (symptom: string) => {
  const isAlreadyAdded = symptoms.value.toLowerCase().includes(symptom.toLowerCase())
  if (isAlreadyAdded) return
  const current = symptoms.value.trim()
  symptoms.value = current ? `${current}, ${symptom}` : symptom
  if (errors.value.symptoms) errors.value.symptoms = ''
}

const severityColors: Record<string, string> = {
  low: 'bg-gradient-to-br from-[#FFDBFD] to-[#C9BEFF] border-[#C9BEFF]',
  medium: 'bg-gradient-to-br from-[#C9BEFF] to-[#8494FF]/30 border-[#8494FF]',
  high: 'bg-gradient-to-br from-[#C9BEFF] to-[#6367FF]/30 border-[#6367FF]',
}
const severityBadge: Record<string, string> = {
  low: 'bg-[#FFDBFD] text-[#24274A]', medium: 'bg-[#C9BEFF] text-[#24274A]', high: 'bg-[#8494FF] text-white',
}

watch(selectedPetId, (newId) => {
  if (!newId) return
  const pet = petOptions.value.find(p => p.id === newId)
  if (!pet) return
  petName.value = pet.name
  const norm = pet.species.trim().toLowerCase()
  if (norm === 'dog' || norm === 'cat') petType.value = norm
  if (pet.age !== null && pet.age !== undefined) petAge.value = String(pet.age)
})

const loadRecommendedVets = async () => {
  loadingVets.value = true
  const { data: profileData, error: profileError } = await supabase.from('profiles').select('id, full_name, email, phone, address').eq('role', 'vet').order('created_at', { ascending: false }).limit(6)
  if (profileError) { toast.error(profileError.message || 'Failed to load vet recommendations'); recommendedVets.value = []; loadingVets.value = false; return }
  const vetProfiles = (profileData || []) as VetProfileRow[]
  if (!vetProfiles.length) { recommendedVets.value = []; loadingVets.value = false; return }
  const vetIds = vetProfiles.map(r => r.id)
  const { data: vetData } = await supabase.from('vets').select('id, clinic_name, clinic_address, specialization, experience_years').in('id', vetIds)
  const vetDetailsMap = new Map<string, VetDetailsRow>()
  ;((vetData || []) as VetDetailsRow[]).forEach(r => { vetDetailsMap.set(r.id, r) })
  recommendedVets.value = vetProfiles.map(profile => {
    const details = vetDetailsMap.get(profile.id)
    return {
      id: profile.id, name: profile.full_name?.trim() || profile.email, email: profile.email,
      phone: profile.phone?.trim() || 'Not provided', address: profile.address?.trim() || 'Not provided',
      clinicName: details?.clinic_name?.trim() || 'Independent Practice',
      clinicAddress: details?.clinic_address?.trim() || profile.address?.trim() || 'Location not provided',
      specialization: details?.specialization?.trim() || 'General Veterinary Care',
      experienceYears: typeof details?.experience_years === 'number' ? `${details.experience_years} years` : 'Not provided',
    }
  })
  loadingVets.value = false
}

const validateForm = () => {
  const e: Record<string, string> = {}
  if (!selectedPetId.value) e.petName = 'Please select your pet'
  if (!petAge.value) e.petAge = 'Pet age is required'
  if (!symptoms.value) e.symptoms = 'Symptoms are required'
  errors.value = e; return Object.keys(e).length === 0
}

const clearHistory = () => {
  consultationHistory.value = []; result.value = null
  window.localStorage.removeItem(CONSULTATION_HISTORY_KEY)
  toast.success('Consultation history cleared.')
}

const saveBookingPrefill = (vet: RecommendedVet) => {
  if (!result.value || !selectedPetId.value) return
  const payload = {
    from: 'consultation', createdAt: new Date().toISOString(), vetId: vet.id, vetName: vet.name,
    petId: selectedPetId.value, petName: petName.value.trim(), petType: petType.value,
    petAge: Number(petAge.value), symptoms: symptoms.value.trim(), severity: result.value.severity,
    possibleIllnesses: result.value.possible_illnesses, recommendations: result.value.recommendations,
  }
  window.localStorage.setItem(CONSULTATION_BOOKING_PREFILL_KEY, JSON.stringify(payload))
}

const handleSubmit = async () => {
  if (!validateForm()) return
  loading.value = true
  try {
    const response = await fetch('/api/consultation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ petType: petType.value, petAge: Number(petAge.value), symptoms: symptoms.value.trim() }),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      throw new Error(errorData?.error || `Consultation failed (${response.status})`)
    }
    const data = await response.json()
    result.value = data
    await loadRecommendedVets()
    const nextHistory: ConsultationHistoryEntry[] = [
      { id: `${Date.now()}`, createdAt: new Date().toISOString(), petName: petName.value.trim(), petType: petType.value, petAge: Number(petAge.value), symptoms: symptoms.value.trim(), result: data },
      ...consultationHistory.value,
    ]
    consultationHistory.value = nextHistory
    window.localStorage.setItem(CONSULTATION_HISTORY_KEY, JSON.stringify(nextHistory))
    toast.success('Consultation analysis complete!')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to get consultation')
  } finally { loading.value = false }
}

onMounted(async () => {
  loadingPets.value = true
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) { loadingPets.value = false; return }
  const { data, error } = await supabase.from('pets').select('id, name, species, age').eq('owner_id', authData.user.id).order('created_at', { ascending: false })
  if (error) { toast.error(error.message || 'Failed to load pets'); petOptions.value = []; loadingPets.value = false; return }
  const rows = (data || []) as PetOption[]
  petOptions.value = rows
  if (!selectedPetId.value && rows.length > 0) selectedPetId.value = rows[0].id
  loadingPets.value = false

  try {
    const raw = window.localStorage.getItem(CONSULTATION_HISTORY_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as ConsultationHistoryEntry[]
    if (!Array.isArray(parsed) || !parsed.length) return
    consultationHistory.value = parsed
    const latest = parsed[0]
    petName.value = latest.petName; petType.value = latest.petType; petAge.value = String(latest.petAge)
    symptoms.value = latest.symptoms; result.value = latest.result
  } catch { window.localStorage.removeItem(CONSULTATION_HISTORY_KEY) }
})
</script>

<template>
  <div class="max-w-2xl mx-auto p-4">
    <AppCard class="mb-6">
      <div class="mb-6 flex items-center gap-3">
        <img src="/Petwellai.svg" alt="Petwell AI logo" class="h-12 w-12" />
        <h2 class="text-2xl font-bold text-[#191D3A]">Petwell AI Consultation</h2>
      </div>
      <form @submit.prevent="handleSubmit" class="space-y-6">
        <div>
          <label class="block text-sm font-medium text-[#32375D] mb-2">Select Pet</label>
          <select v-model="selectedPetId" class="w-full px-4 py-2 border border-[#C9BEFF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8494FF]" :disabled="loadingPets || petOptions.length === 0">
            <option value="">Select your pet</option>
            <option v-for="pet in petOptions" :key="pet.id" :value="pet.id">{{ pet.name }} ({{ pet.species }})</option>
          </select>
          <p v-if="errors.petName" class="text-[#6367FF] text-sm mt-1">{{ errors.petName }}</p>
          <p v-if="petOptions.length === 0 && !loadingPets" class="text-sm text-[#32375D] mt-2">
            No pets found. <RouterLink to="/pets/add" class="font-semibold text-[#6367FF] hover:underline">Add a pet first</RouterLink>.
          </p>
        </div>
        <div>
          <label class="block text-sm font-medium text-[#32375D] mb-2">Pet Type</label>
          <select v-model="petType" class="w-full px-4 py-2 border border-[#C9BEFF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8494FF]">
            <option value="dog">Dog</option><option value="cat">Cat</option>
          </select>
        </div>
        <AppInput label="Pet Age (in years)" type="number" v-model="petAge" :error="errors.petAge" placeholder="Enter pet's age" min="0" step="0.1" />
        <div>
          <label class="block text-sm font-medium text-[#32375D] mb-2">Symptoms Description</label>

          <!-- Symptom suggestion panel -->
          <div class="mb-3 rounded-xl border border-[#C9BEFF] bg-[#F7F5FF] p-3">
            <div class="flex flex-wrap items-center gap-2 mb-3">
              <span class="text-xs font-semibold text-[#5E6288]">Quick add:</span>
              <!-- Category tabs -->
              <div class="flex flex-wrap gap-1">
                <button
                  v-for="cat in symptomCategories" :key="cat" type="button"
                  @click="selectedSymptomCategory = cat"
                  :class="[
                    'px-2.5 py-1 rounded-full text-xs font-semibold transition-all',
                    selectedSymptomCategory === cat
                      ? 'bg-[#6367FF] text-white shadow'
                      : 'bg-white border border-[#C9BEFF] text-[#5E6288] hover:border-[#8494FF]'
                  ]"
                >{{ cat }}</button>
              </div>
            </div>
            <!-- Symptom chips -->
            <div class="flex flex-wrap gap-2">
              <button
                v-for="s in currentSuggestions" :key="s" type="button"
                @click="addSymptom(s)"
                :class="[
                  'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  addedSymptoms.has(s)
                    ? 'bg-[#6367FF] border-[#6367FF] text-white cursor-default'
                    : 'bg-white border-[#C9BEFF] text-[#32375D] hover:bg-[#EDE9FF] hover:border-[#8494FF]'
                ]"
                :title="addedSymptoms.has(s) ? 'Already added' : `Add: ${s}`"
              >
                <svg v-if="addedSymptoms.has(s)" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
                {{ s }}
              </button>
            </div>
          </div>

          <!-- Textarea -->
          <textarea
            v-model="symptoms"
            :class="['w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8494FF] text-sm resize-none transition', errors.symptoms ? 'border-[#6367FF]' : 'border-[#C9BEFF]']"
            :rows="4"
            placeholder="Click symptoms above or type your own description here..."
          />
          <p v-if="errors.symptoms" class="text-[#6367FF] text-sm mt-1">{{ errors.symptoms }}</p>
        </div>
        <AppButton type="submit" :loading="loading" variant="primary" size="lg" class="w-full">Get AI Analysis</AppButton>
      </form>
    </AppCard>

    <AppCard v-if="consultationHistory.length > 0" class="mb-6 border border-[#C9BEFF]">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-lg font-bold text-[#191D3A]">Previous Consultations</h3>
          <p class="text-sm text-[#24274A]/75">Your recent AI consultation results are saved on this device.</p>
        </div>
        <AppButton variant="secondary" size="sm" @click="clearHistory">Clear History</AppButton>
      </div>
      <div class="space-y-2">
        <button v-for="entry in consultationHistory" :key="entry.id" type="button"
          @click="router.push(`/profile?section=recent-consultations&consultationId=${encodeURIComponent(entry.id)}`)"
          class="w-full rounded-lg border border-[#C9BEFF] bg-white/70 px-4 py-3 text-left transition hover:border-[#8494FF]"
        >
          <p class="font-semibold text-[#191D3A]">{{ entry.petName }} ({{ entry.petType.toUpperCase() }})</p>
          <p class="text-sm text-[#32375D]">{{ new Date(entry.createdAt).toLocaleString() }} • Severity: {{ entry.result.severity.toUpperCase() }}</p>
          <p class="mt-1 line-clamp-2 text-sm text-[#24274A]/80">Symptoms: {{ entry.symptoms }}</p>
          <p class="mt-2 text-xs font-semibold text-[#6367FF]">Open in Profile Recent Consultations</p>
        </button>
      </div>
    </AppCard>

    <AppCard v-if="result" :class="['border-2', severityColors[result.severity]]">
      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 class="text-2xl font-bold text-[#191D3A]">Analysis Results</h3>
          <p class="text-sm text-[#24274A]/75">Review possible conditions, care tips, and next-step recommendations.</p>
        </div>
        <span :class="['px-4 py-1 rounded-full font-semibold text-sm', severityBadge[result.severity]]">Severity: {{ result.severity.toUpperCase() }}</span>
      </div>
      <div class="grid gap-4 md:grid-cols-3">
        <section class="rounded-xl border border-[#C9BEFF]/80 bg-white/70 p-4">
          <h4 class="mb-3 text-base font-semibold text-[#24274A]">Possible Illnesses</h4>
          <ul class="space-y-2 text-sm">
            <li v-if="result.possible_illnesses.length === 0" class="text-[#24274A]/70">No possible illnesses were identified.</li>
            <li v-for="(illness, i) in result.possible_illnesses" :key="i" class="flex items-start">
              <span class="mr-2 mt-0.5 text-[#6367FF]">•</span><span class="text-[#24274A]/85">{{ illness }}</span>
            </li>
          </ul>
        </section>
        <section class="rounded-xl border border-[#C9BEFF]/80 bg-white/70 p-4">
          <h4 class="mb-3 text-base font-semibold text-[#24274A]">Care Tips</h4>
          <ul class="space-y-2 text-sm">
            <li v-if="result.tips.length === 0" class="text-[#24274A]/70">No care tips were returned.</li>
            <li v-for="(tip, i) in result.tips" :key="i" class="flex items-start">
              <span class="mr-2 mt-0.5 text-[#8494FF]">•</span><span class="text-[#24274A]/85">{{ tip }}</span>
            </li>
          </ul>
        </section>
        <section class="rounded-xl border border-[#C9BEFF]/80 bg-white/70 p-4">
          <h4 class="mb-3 text-base font-semibold text-[#24274A]">Recommendations</h4>
          <ul class="space-y-2 text-sm">
            <li v-if="result.recommendations.length === 0" class="text-[#24274A]/70">No recommendations were returned.</li>
            <li v-for="(rec, i) in result.recommendations" :key="i" class="flex items-start">
              <span class="mr-2 mt-0.5 text-[#6367FF]">•</span><span class="text-[#24274A]/85">{{ rec }}</span>
            </li>
          </ul>
        </section>
      </div>
      <!-- HIGH SEVERITY: show vet recommendations + booking -->
      <div v-if="result.severity === 'high'" class="mt-6 border-t border-[#C9BEFF] pt-5">
        <div class="mb-4 rounded-xl bg-[#6367FF]/10 border border-[#6367FF]/30 px-4 py-3 flex items-start gap-3">
          <svg class="w-5 h-5 text-[#6367FF] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
          <div>
            <p class="font-semibold text-[#6367FF] text-sm">Immediate Veterinary Attention Recommended</p>
            <p class="text-xs text-[#32375D] mt-0.5">Your pet's symptoms indicate a high-severity condition. Please book an appointment or contact a vet as soon as possible.</p>
          </div>
        </div>
        <AppButton variant="primary" size="lg" class="w-full" @click="router.push('/appointments')">Book Appointment with Veterinarian</AppButton>
        <div class="mt-4 rounded-xl border border-[#C9BEFF] bg-white/70 p-4">
          <h4 class="text-lg font-semibold text-[#191D3A] mb-1">Recommended Veterinarian Contacts</h4>
          <p class="text-sm pw-subtext mb-4">Based on available registered vet clinics.</p>
          <p v-if="loadingVets" class="pw-subtext">Loading vet recommendations...</p>
          <p v-else-if="recommendedVets.length === 0" class="pw-subtext">No registered veterinarian details available yet.</p>
          <div v-else class="space-y-3">
            <div v-for="vet in recommendedVets" :key="vet.id" class="rounded-lg border border-[#C9BEFF] bg-[#FFDBFD]/35 p-3">
              <p class="font-semibold text-[#191D3A]">{{ vet.name }}</p>
              <p class="text-sm pw-subtext">Clinic: {{ vet.clinicName }}</p>
              <p class="text-sm pw-subtext">Specialization: {{ vet.specialization }}</p>
              <p class="text-sm pw-subtext">Experience: {{ vet.experienceYears }}</p>
              <p class="text-sm text-[#32375D] mt-2">Contact: {{ vet.phone }}</p>
              <p class="text-sm text-[#32375D]">Email: {{ vet.email }}</p>
              <p class="text-sm text-[#32375D]">Address: {{ vet.clinicAddress }}</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <a :href="`tel:${vet.phone}`" class="rounded-md border border-[#8494FF] px-3 py-1 text-sm font-semibold text-[#6367FF]">Call Vet</a>
                <AppButton variant="secondary" size="sm" @click="saveBookingPrefill(vet); router.push(`/appointments?from=consultation&vetId=${encodeURIComponent(vet.id)}`)">Book Appointment</AppButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- MEDIUM / LOW SEVERITY: gentle info banner only (tips & recommendations above are sufficient) -->
      <div v-else-if="result.severity === 'medium' || result.severity === 'low'" class="mt-6 border-t border-[#C9BEFF] pt-5">
        <div class="rounded-xl border px-4 py-4 flex items-start gap-3"
          :class="result.severity === 'medium' ? 'bg-[#C9BEFF]/20 border-[#C9BEFF]' : 'bg-[#FFDBFD]/30 border-[#FFDBFD]'"
        >
          <svg class="w-5 h-5 mt-0.5 shrink-0" :class="result.severity === 'medium' ? 'text-[#8494FF]' : 'text-[#a78bfa]'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <div>
            <p class="font-semibold text-[#24274A] text-sm">
              {{ result.severity === 'medium' ? 'Monitor Your Pet Closely' : 'Your Pet Should Be Fine' }}
            </p>
            <p class="text-xs text-[#32375D] mt-0.5">
              {{ result.severity === 'medium'
                ? 'The severity is moderate. Follow the care tips and recommendations above. If symptoms worsen or persist for more than 48 hours, consider visiting a veterinarian.'
                : 'The severity is low. The tips and recommendations above should be sufficient. Keep monitoring your pet and consult a vet if things do not improve.' }}
            </p>
          </div>
        </div>
      </div>
    </AppCard>
  </div>
</template>
