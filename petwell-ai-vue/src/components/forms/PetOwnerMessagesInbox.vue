<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import { supabase } from '@/lib/supabase'
import AppCard from '@/components/ui/AppCard.vue'
import AppointmentMessageThread from './AppointmentMessageThread.vue'

interface AppointmentRow { id: string; vet_id: string; pet_id: string; appointment_date: string; status: 'pending'|'confirmed'|'completed'|'cancelled' }
interface VetRow { id: string; full_name: string | null; email: string }
interface PetRow { id: string; name: string }
interface MessageRow { id: string; appointment_id: string }

const route = useRoute()
const toast = useToast()
const selectedVetId = computed(() => route.query.vetId as string | undefined)
const selectedVetName = computed(() => route.query.vetName as string | undefined)

const loading = ref(true)
const ownerId = ref<string | null>(null)
const appointments = ref<AppointmentRow[]>([])
const vetsById = ref<Record<string, VetRow>>({})
const petsById = ref<Record<string, PetRow>>({})
const messageCounts = ref<Record<string, number>>({})

const hasSelectedVetConversation = computed(() => selectedVetId.value ? appointments.value.some(a => a.vet_id === selectedVetId.value) : false)
const orderedAppointments = computed(() => {
  if (!selectedVetId.value) return appointments.value
  return [...appointments.value].sort((a, b) => {
    const aS = a.vet_id === selectedVetId.value ? 0 : 1, bS = b.vet_id === selectedVetId.value ? 0 : 1
    if (aS !== bS) return aS - bS
    return new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime()
  })
})

onMounted(async () => {
  loading.value = true
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) { toast.error('Please sign in to view messages'); loading.value = false; return }
  ownerId.value = authData.user.id
  const { data: apptData, error: apptError } = await supabase.from('appointments').select('id, vet_id, pet_id, appointment_date, status').eq('pet_owner_id', authData.user.id).in('status', ['confirmed', 'completed']).order('appointment_date', { ascending: false })
  if (apptError) { toast.error(apptError.message || 'Failed to load inbox'); loading.value = false; return }
  const rows = (apptData || []) as AppointmentRow[]
  appointments.value = rows
  if (!rows.length) { loading.value = false; return }
  const vetIds = Array.from(new Set(rows.map(r => r.vet_id)))
  const petIds = Array.from(new Set(rows.map(r => r.pet_id)))
  const apptIds = rows.map(r => r.id)
  const [{ data: vetData, error: vetError }, { data: petData, error: petError }, { data: msgData, error: msgError }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').in('id', vetIds),
    supabase.from('pets').select('id, name').in('id', petIds),
    supabase.from('appointment_messages').select('id, appointment_id').in('appointment_id', apptIds),
  ])
  if (vetError) toast.error(vetError.message); if (petError) toast.error(petError.message); if (msgError) toast.error(msgError.message)
  const vm: Record<string, VetRow> = {}; ((vetData || []) as VetRow[]).forEach(v => { vm[v.id] = v })
  const pm: Record<string, PetRow> = {}; ((petData || []) as PetRow[]).forEach(p => { pm[p.id] = p })
  const cm: Record<string, number> = {}; ((msgData || []) as MessageRow[]).forEach(m => { cm[m.appointment_id] = (cm[m.appointment_id] || 0) + 1 })
  vetsById.value = vm; petsById.value = pm; messageCounts.value = cm; loading.value = false
})
</script>

<template>
  <div v-if="loading" class="max-w-5xl mx-auto p-4"><AppCard><p class="pw-subtext">Loading messages...</p></AppCard></div>
  <div v-else class="max-w-5xl mx-auto p-4 space-y-6">
    <AppCard>
      <h2 class="text-3xl font-bold text-[#191D3A] mb-2">Messages</h2>
      <p class="pw-subtext">View and reply to messages from your veterinarian.</p>
      <div v-if="selectedVetId && hasSelectedVetConversation" class="mt-3 rounded-lg border border-[#8494FF] bg-[#C9BEFF]/35 p-3">
        <p class="text-sm font-semibold text-[#24274A]">Now showing messages for {{ selectedVetName || 'your selected vet clinic' }} first.</p>
      </div>
      <div v-if="selectedVetId && !hasSelectedVetConversation" class="mt-3 rounded-lg border border-[#C9BEFF] bg-[#FFDBFD]/55 p-3">
        <p class="text-sm text-[#24274A]">No approved message thread yet for {{ selectedVetName || 'this vet clinic' }}.</p>
        <RouterLink to="/appointments" class="mt-2 inline-block text-sm font-semibold text-[#6367FF] hover:underline">Go to Appointments</RouterLink>
      </div>
    </AppCard>
    <AppCard>
      <p v-if="appointments.length === 0" class="pw-subtext">No approved appointments available for messaging yet.</p>
      <div v-else class="space-y-4">
        <div v-for="appt in orderedAppointments" :key="appt.id" class="rounded-xl border border-[#C9BEFF] bg-white/80 p-4">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="font-semibold text-[#191D3A]">Vet: {{ vetsById[appt.vet_id]?.full_name?.trim() || vetsById[appt.vet_id]?.email || 'Veterinarian' }}</p>
              <p class="text-sm pw-subtext mt-1">Pet: {{ petsById[appt.pet_id]?.name || 'Pet' }} | Appointment: {{ new Date(appt.appointment_date).toLocaleString() }}</p>
            </div>
            <span class="self-start rounded-full bg-[#C9BEFF] px-3 py-1 text-xs font-semibold text-[#24274A]">Messages: {{ messageCounts[appt.id] || 0 }}</span>
          </div>
          <AppointmentMessageThread :appointmentId="appt.id" :currentUserId="ownerId" :canMessage="appt.status === 'confirmed' || appt.status === 'completed'" />
        </div>
      </div>
    </AppCard>
  </div>
</template>
