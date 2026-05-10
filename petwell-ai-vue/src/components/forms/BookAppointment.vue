<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import { supabase } from '@/lib/supabase'
import AppCard from '@/components/ui/AppCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppointmentMessageThread from './AppointmentMessageThread.vue'

interface ConsultationBookingPrefill { from: 'consultation'; createdAt: string; vetId: string; vetName: string; petId: string; petName: string; petType: 'dog' | 'cat'; petAge: number; symptoms: string; severity: 'low'|'medium'|'high'; possibleIllnesses: string[]; recommendations: string[] }
interface VetProfileRow { id: string; full_name: string | null; email: string }
interface VetDetailsRow { id: string; clinic_name: string | null; specialization: string | null }
interface PetRow { id: string; name: string; species: string; breed: string | null }
interface VetCardItem { id: string; name: string; clinic: string; specialization: string }
interface OwnerAppointmentRow { id: string; vet_id: string; pet_id: string; appointment_date: string; appointment_type: string | null; status: 'pending'|'confirmed'|'completed'|'cancelled'; notes: string | null }

const CONSULTATION_BOOKING_PREFILL_KEY = 'petwell_consultation_booking_prefill_v1'

const route = useRoute()
const toast = useToast()

const prefVetId = computed(() => route.query.vetId as string | undefined)
const fromConsultation = computed(() => route.query.from === 'consultation')

const userId = ref<string | null>(null)
const isPetOwner = ref(true)
const initialLoading = ref(true)
const selectedVet = ref('')
const selectedPet = ref('')
const appointmentDate = ref('')
const appointmentTime = ref('')
const notes = ref('')
const loading = ref(false)
const vets = ref<VetCardItem[]>([])
const pets = ref<PetRow[]>([])
const appointments = ref<OwnerAppointmentRow[]>([])
const consultationPrefill = ref<ConsultationBookingPrefill | null>(null)

const selectedVetData = computed(() => vets.value.find(v => v.id === selectedVet.value) || null)
const selectedPetData = computed(() => pets.value.find(p => p.id === selectedPet.value) || null)
const vetMap = computed(() => vets.value.reduce<Record<string, VetCardItem>>((acc, v) => { acc[v.id] = v; return acc }, {}))
const petMap = computed(() => pets.value.reduce<Record<string, PetRow>>((acc, p) => { acc[p.id] = p; return acc }, {}))

watch([consultationPrefill, vets, pets], () => {
  const pf = consultationPrefill.value
  if (!pf) return
  const pid = prefVetId.value
  if (pid && vets.value.some(v => v.id === pid)) selectedVet.value = pid
  else if (vets.value.some(v => v.id === pf.vetId)) selectedVet.value = pf.vetId
  if (!selectedPet.value) {
    if (pf.petId && pets.value.some(p => p.id === pf.petId)) selectedPet.value = pf.petId
    else { const m = pets.value.find(p => p.name.trim().toLowerCase() === pf.petName.trim().toLowerCase()); if (m) selectedPet.value = m.id }
  }
  if (!notes.value.trim()) {
    const illnessSummary = pf.possibleIllnesses.slice(0, 3).join(', ') || 'N/A'
    const recSummary = pf.recommendations.slice(0, 3).join('; ') || 'N/A'
    notes.value = [`Consultation Summary (${new Date(pf.createdAt).toLocaleString()}):`, `Pet: ${pf.petName} (${pf.petType}, ${pf.petAge} years old)`, `Symptoms: ${pf.symptoms}`, `AI Severity: ${pf.severity.toUpperCase()}`, `Possible Illnesses: ${illnessSummary}`, `Recommendations: ${recSummary}`].join('\n')
  }
})

const loadOwnerAppointments = async (ownerId: string) => {
  const { data, error } = await supabase.from('appointments').select('id, vet_id, pet_id, appointment_date, appointment_type, status, notes').eq('pet_owner_id', ownerId).order('appointment_date', { ascending: false })
  if (error) { toast.error(error.message || 'Failed to load appointments'); appointments.value = []; return }
  appointments.value = (data || []) as OwnerAppointmentRow[]
}

const handleBooking = async () => {
  if (!userId.value) { toast.error('Please sign in'); return }
  if (!selectedPet.value || !selectedVet.value || !appointmentDate.value || !appointmentTime.value) { toast.error('Please fill in all required fields'); return }
  loading.value = true
  try {
    const dt = new Date(`${appointmentDate.value}T${appointmentTime.value}:00`)
    if (Number.isNaN(dt.getTime())) throw new Error('Invalid appointment date/time')
    const { data: inserted, error } = await supabase.from('appointments').insert([{ pet_owner_id: userId.value, pet_id: selectedPet.value, vet_id: selectedVet.value, appointment_date: dt.toISOString(), appointment_type: 'consultation', status: 'confirmed', notes: notes.value.trim() || null }]).select('id').single()
    if (error) throw error
    if (inserted?.id) {
      const { error: notifyError } = await supabase.rpc('create_appointment_request_notification', { p_appointment_id: inserted.id })
      if (notifyError) toast.error(notifyError.message || 'Appointment booked, but vet notification failed')
    }
    toast.success('Appointment booked and approved successfully.')
    window.localStorage.removeItem(CONSULTATION_BOOKING_PREFILL_KEY)
    selectedVet.value = ''; selectedPet.value = ''; appointmentDate.value = ''; appointmentTime.value = ''; notes.value = ''; consultationPrefill.value = null
    await loadOwnerAppointments(userId.value)
  } catch (err: any) { toast.error(err?.message || 'Failed to book appointment') }
  finally { loading.value = false }
}

const getStatusLabel = (status: string) => {
  if (status === 'pending') return 'Waiting for vet approval'
  if (status === 'confirmed') return 'Approved by vet clinic'
  if (status === 'cancelled') return 'Declined by vet clinic'
  return status
}
const getStatusClass = (status: string) => {
  if (status === 'pending') return 'bg-[#FFF1B8] text-[#7A5A00]'
  if (status === 'confirmed') return 'bg-[#CFF7DE] text-[#1E6B3A]'
  if (status === 'cancelled') return 'bg-[#FFD9E4] text-[#8F1F47]'
  return 'bg-[#C9BEFF] text-[#24274A]'
}

onMounted(async () => {
  if (fromConsultation.value) {
    try {
      const raw = window.localStorage.getItem(CONSULTATION_BOOKING_PREFILL_KEY)
      if (raw) { const parsed = JSON.parse(raw) as ConsultationBookingPrefill; if (parsed?.vetId && parsed.from === 'consultation') consultationPrefill.value = parsed }
    } catch { window.localStorage.removeItem(CONSULTATION_BOOKING_PREFILL_KEY) }
  }
  initialLoading.value = true
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) { toast.error('Please sign in to book an appointment'); initialLoading.value = false; return }
  userId.value = authData.user.id
  const { data: profileData, error: profileError } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single()
  if (profileError) { toast.error(profileError.message || 'Failed to load profile'); initialLoading.value = false; return }
  const ownerRole = profileData?.role === 'pet_owner'; isPetOwner.value = ownerRole
  if (!ownerRole) { initialLoading.value = false; return }
  const [{ data: petData, error: petError }, { data: vetProfiles, error: vetProfilesError }] = await Promise.all([
    supabase.from('pets').select('id, name, species, breed').eq('owner_id', authData.user.id).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, email').eq('role', 'vet').order('created_at', { ascending: false }),
  ])
  if (petError) toast.error(petError.message || 'Failed to load pets')
  else pets.value = (petData || []) as PetRow[]
  if (vetProfilesError) { toast.error(vetProfilesError.message || 'Failed to load vets'); initialLoading.value = false; return }
  const vetRows = ((vetProfiles || []) as VetProfileRow[]).filter(r => r.id !== authData.user.id)
  if (!vetRows.length) { vets.value = []; initialLoading.value = false; return }
  const vetIds = vetRows.map(v => v.id)
  const { data: vetDetailsData } = await supabase.from('vets').select('id, clinic_name, specialization').in('id', vetIds)
  const vetDetailsMap = new Map<string, VetDetailsRow>()
  ;((vetDetailsData || []) as VetDetailsRow[]).forEach(d => { vetDetailsMap.set(d.id, d) })
  vets.value = vetRows.map(v => { const d = vetDetailsMap.get(v.id); return { id: v.id, name: v.full_name?.trim() || v.email, clinic: d?.clinic_name?.trim() || 'Independent Practice', specialization: d?.specialization?.trim() || 'General Veterinary Care' } })
  await loadOwnerAppointments(authData.user.id)
  initialLoading.value = false
})
</script>

<template>
  <div v-if="initialLoading" class="max-w-4xl mx-auto p-4"><AppCard><p class="pw-subtext">Loading booking form...</p></AppCard></div>
  <div v-else-if="!isPetOwner" class="max-w-4xl mx-auto p-4"><AppCard><h2 class="text-2xl font-bold text-[#191D3A] mb-2">Book Appointment</h2><p class="pw-subtext">Appointment booking is available for pet owner accounts only.</p></AppCard></div>
  <div v-else class="max-w-4xl mx-auto p-4 space-y-6">
    <AppCard>
      <h2 class="text-3xl font-bold text-[#191D3A] mb-2">Book Appointment</h2>
      <p class="pw-subtext mb-6">Select your pet, choose a registered veterinarian, and schedule your appointment</p>
      <div v-if="fromConsultation && consultationPrefill" class="mb-6 rounded-lg border border-[#8494FF] bg-[#C9BEFF]/35 p-4">
        <p class="text-sm font-semibold text-[#24274A]">Consultation details loaded. Veterinarian and notes are prefilled from your AI consultation.</p>
        <p class="mt-1 text-sm text-[#32375D]">Please choose your pet and schedule date/time, then confirm booking.</p>
      </div>
      <div v-if="pets.length === 0" class="mb-6 rounded-lg border border-[#C9BEFF] bg-[#FFDBFD]/55 p-4">
        <p class="text-sm text-[#32375D]">You need at least one pet profile before booking. <RouterLink to="/pets/add" class="font-semibold text-[#6367FF] hover:underline">Add your pet here</RouterLink>.</p>
      </div>
      <div class="space-y-3 mb-6">
        <h3 class="text-lg font-semibold text-[#191D3A]">Select Your Pet</h3>
        <div>
          <label class="block text-sm font-medium text-[#32375D] mb-2">Pet</label>
          <select v-model="selectedPet" class="w-full px-4 py-2 border border-[#C9BEFF] rounded-lg hover:border-[#8494FF]/70 focus:outline-none focus:ring-2 focus:ring-[#8494FF]/60" :disabled="!pets.length">
            <option value="">Select your pet</option>
            <option v-for="pet in pets" :key="pet.id" :value="pet.id">{{ pet.name }} ({{ pet.species }}{{ pet.breed ? ` | ${pet.breed}` : '' }})</option>
          </select>
        </div>
      </div>
      <div class="space-y-4 mb-6">
        <h3 class="text-lg font-semibold text-[#191D3A]">Select a Registered Veterinarian</h3>
        <div v-if="!vets.length" class="rounded-lg border border-[#C9BEFF] bg-white/70 p-4"><p class="pw-subtext">No veterinarian users found yet.</p></div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div v-for="vet in vets" :key="vet.id" @click="selectedVet = vet.id" :class="['border-2 rounded-lg p-4 cursor-pointer transition-all', selectedVet === vet.id ? 'border-[#8494FF] bg-gradient-to-br from-[#FFDBFD] to-[#C9BEFF]' : 'border-[#D8D4F6] hover:border-[#C9BEFF]']">
            <div class="flex items-start mb-3">
              <div class="w-12 h-12 bg-gradient-to-br from-[#8494FF] to-[#6367FF] rounded-full flex items-center justify-center text-white text-xs font-bold mr-3">VET</div>
              <div><p class="font-semibold text-[#191D3A]">{{ vet.name }}</p><p class="text-sm pw-subtext">{{ vet.clinic }}</p></div>
            </div>
            <div class="text-sm pw-subtext space-y-1"><p>Specialization: {{ vet.specialization }}</p></div>
          </div>
        </div>
      </div>
      <div v-if="selectedVet" class="space-y-4 border-t pt-6">
        <h3 class="text-lg font-semibold text-[#191D3A]">Schedule Details</h3>
        <AppInput label="Appointment Date" type="date" v-model="appointmentDate" :min="new Date().toISOString().split('T')[0]" />
        <AppInput label="Appointment Time" type="time" v-model="appointmentTime" />
        <div>
          <label class="block text-sm font-medium text-[#32375D] mb-2">Additional Notes (Optional)</label>
          <textarea v-model="notes" class="w-full px-4 py-2 border border-[#C9BEFF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8494FF]" :rows="4" placeholder="Any additional information for the vet..." />
        </div>
        <div class="bg-gray-50 p-4 rounded-lg">
          <p class="text-sm pw-subtext mb-2">Booking Summary</p>
          <div class="space-y-1 text-sm">
            <p><span class="font-semibold">Pet:</span> {{ selectedPetData ? `${selectedPetData.name} (${selectedPetData.species})` : '-' }}</p>
            <p><span class="font-semibold">Veterinarian:</span> {{ selectedVetData?.name || '-' }}</p>
            <p><span class="font-semibold">Date:</span> {{ appointmentDate ? new Date(appointmentDate).toLocaleDateString() : '-' }}</p>
            <p><span class="font-semibold">Time:</span> {{ appointmentTime || '-' }}</p>
            <p><span class="font-semibold">Clinic:</span> {{ selectedVetData?.clinic || '-' }}</p>
          </div>
        </div>
        <AppButton variant="primary" size="lg" class="w-full" :loading="loading" :disabled="!selectedPet || !selectedVet || !appointmentDate || !appointmentTime || !pets.length" @click="handleBooking">Confirm Booking</AppButton>
      </div>
    </AppCard>
    <AppCard>
      <h3 class="text-xl font-bold text-[#191D3A] mb-2">My Appointment Requests</h3>
      <p class="pw-subtext mb-4">Track your booking status and appointment details.</p>
      <p v-if="appointments.length === 0" class="pw-subtext">No appointment requests yet.</p>
      <div v-else class="space-y-3">
        <div v-for="appt in appointments" :key="appt.id" class="rounded-xl border border-[#C9BEFF] bg-white/80 p-4">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p class="font-semibold text-[#191D3A]">{{ new Date(appt.appointment_date).toLocaleString() }}</p>
              <p class="text-sm pw-subtext mt-1">Vet: {{ vetMap[appt.vet_id]?.name || 'Veterinarian' }}{{ vetMap[appt.vet_id]?.clinic ? ` | ${vetMap[appt.vet_id].clinic}` : '' }}</p>
              <p class="text-sm pw-subtext">Pet: {{ petMap[appt.pet_id]?.name || 'Pet' }}{{ appt.appointment_type ? ` | Type: ${appt.appointment_type}` : '' }}</p>
            </div>
            <span :class="['self-start rounded-full px-3 py-1 text-sm font-semibold', getStatusClass(appt.status)]">{{ getStatusLabel(appt.status) }}</span>
          </div>
          <AppointmentMessageThread :appointmentId="appt.id" :currentUserId="userId" :canMessage="appt.status === 'confirmed' || appt.status === 'completed'" />
        </div>
      </div>
    </AppCard>
  </div>
</template>
