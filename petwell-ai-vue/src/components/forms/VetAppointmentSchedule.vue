<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { supabase } from '@/lib/supabase'
import AppCard from '@/components/ui/AppCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppointmentMessageThread from './AppointmentMessageThread.vue'

interface AppointmentRow { id: string; pet_owner_id: string; pet_id: string; appointment_date: string; appointment_type: string | null; status: 'pending'|'confirmed'|'completed'|'cancelled'; notes: string | null }
interface PetRow { id: string; name: string; species: string }
interface OwnerRow { id: string; full_name: string | null; email: string }

const toast = useToast()
const loading = ref(true)
const vetId = ref<string | null>(null)
const updatingId = ref<string | null>(null)
const appointments = ref<AppointmentRow[]>([])
const petsById = ref<Record<string, PetRow>>({})
const ownersById = ref<Record<string, OwnerRow>>({})

const groupedAppointments = computed(() => {
  return appointments.value.reduce<Record<string, AppointmentRow[]>>((acc, appt) => {
    const key = new Date(appt.appointment_date).toLocaleDateString()
    if (!acc[key]) acc[key] = []
    acc[key].push(appt)
    return acc
  }, {})
})

const handleStatusUpdate = async (appointmentId: string, nextStatus: 'confirmed' | 'cancelled') => {
  if (!vetId.value) { toast.error('Unable to verify veterinarian account'); return }
  updatingId.value = appointmentId
  const { data: updatedRow, error } = await supabase.from('appointments').update({ status: nextStatus }).eq('id', appointmentId).select('id, status').maybeSingle()
  if (error) { toast.error(error.message || 'Failed to update'); updatingId.value = null; return }
  if (!updatedRow) { toast.error('Appointment not found.'); updatingId.value = null; return }
  appointments.value = appointments.value.map(a => a.id === appointmentId ? { ...a, status: nextStatus } : a)
  toast.success(nextStatus === 'confirmed' ? 'Appointment approved successfully' : 'Appointment declined successfully')
  updatingId.value = null
}

onMounted(async () => {
  loading.value = true
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) { toast.error('Please sign in to view your appointment schedule'); loading.value = false; return }
  vetId.value = authData.user.id
  const { data: apptData, error: apptError } = await supabase.from('appointments').select('id, pet_owner_id, pet_id, appointment_date, appointment_type, status, notes').eq('vet_id', authData.user.id).order('appointment_date', { ascending: true })
  if (apptError) { toast.error(apptError.message || 'Failed to load schedule'); appointments.value = []; loading.value = false; return }
  const rows = (apptData || []) as AppointmentRow[]
  appointments.value = rows
  if (!rows.length) { loading.value = false; return }
  const petIds = Array.from(new Set(rows.map(r => r.pet_id)))
  const ownerIds = Array.from(new Set(rows.map(r => r.pet_owner_id)))
  const [{ data: petData, error: petError }, { data: ownerData, error: ownerError }] = await Promise.all([
    supabase.from('pets').select('id, name, species').in('id', petIds),
    supabase.from('profiles').select('id, full_name, email').in('id', ownerIds),
  ])
  if (petError) toast.error(petError.message); if (ownerError) toast.error(ownerError.message)
  const pm: Record<string, PetRow> = {}; ((petData || []) as PetRow[]).forEach(p => { pm[p.id] = p })
  const om: Record<string, OwnerRow> = {}; ((ownerData || []) as OwnerRow[]).forEach(o => { om[o.id] = o })
  petsById.value = pm; ownersById.value = om; loading.value = false
})
</script>

<template>
  <div class="max-w-5xl mx-auto p-4 space-y-6">
    <AppCard>
      <h2 class="text-3xl font-bold text-[#191D3A] mb-2">Appointment Schedule</h2>
      <p class="pw-subtext">Appointments booked by pet owners for your veterinary clinic.</p>
    </AppCard>
    <AppCard>
      <p v-if="loading" class="pw-subtext">Loading appointment schedule...</p>
      <p v-else-if="appointments.length === 0" class="pw-subtext">No appointments yet.</p>
      <div v-else class="space-y-6">
        <div v-for="(dayAppts, dateLabel) in groupedAppointments" :key="dateLabel" class="space-y-3">
          <h3 class="text-lg font-bold text-[#191D3A]">{{ dateLabel }}</h3>
          <div v-for="appt in dayAppts" :key="appt.id" class="rounded-xl border border-[#C9BEFF] bg-gradient-to-br from-[#FFDBFD]/55 to-white/80 p-4">
            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p class="font-semibold text-[#191D3A]">{{ new Date(appt.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }} • {{ petsById[appt.pet_id]?.name || 'Pet' }}</p>
                <p class="text-sm pw-subtext mt-1">Owner: {{ ownersById[appt.pet_owner_id]?.full_name?.trim() || ownersById[appt.pet_owner_id]?.email || 'Unknown' }}</p>
                <p class="text-sm pw-subtext">Type: {{ appt.appointment_type || 'consultation' }}{{ petsById[appt.pet_id]?.species ? ` | Species: ${petsById[appt.pet_id].species}` : '' }}</p>
                <p v-if="appt.notes" class="text-sm text-[#32375D] mt-2">Notes: {{ appt.notes }}</p>
              </div>
              <div class="flex flex-col items-start gap-2">
                <span class="self-start rounded-full bg-[#C9BEFF] px-3 py-1 text-sm font-semibold text-[#24274A]">{{ appt.status }}</span>
                <div v-if="appt.status === 'pending'" class="flex gap-2">
                  <AppButton size="sm" variant="primary" :loading="updatingId === appt.id" @click="handleStatusUpdate(appt.id, 'confirmed')">Approve</AppButton>
                  <AppButton size="sm" variant="secondary" :disabled="updatingId === appt.id" @click="handleStatusUpdate(appt.id, 'cancelled')">Decline</AppButton>
                </div>
              </div>
            </div>
            <AppointmentMessageThread :appointmentId="appt.id" :currentUserId="vetId" :canMessage="appt.status === 'confirmed' || appt.status === 'completed'" />
          </div>
        </div>
      </div>
    </AppCard>
  </div>
</template>
