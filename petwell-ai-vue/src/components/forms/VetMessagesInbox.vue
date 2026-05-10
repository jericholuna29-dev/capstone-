<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { supabase } from '@/lib/supabase'
import AppCard from '@/components/ui/AppCard.vue'
import AppointmentMessageThread from './AppointmentMessageThread.vue'

interface AppointmentRow { id: string; pet_owner_id: string; pet_id: string; appointment_date: string; status: 'pending'|'confirmed'|'completed'|'cancelled' }
interface PetRow { id: string; name: string }
interface OwnerRow { id: string; full_name: string | null; email: string }
interface MessageRow { id: string; appointment_id: string }

const toast = useToast()
const loading = ref(true)
const role = ref<string | null>(null)
const vetId = ref<string | null>(null)
const appointments = ref<AppointmentRow[]>([])
const petsById = ref<Record<string, PetRow>>({})
const ownersById = ref<Record<string, OwnerRow>>({})
const messageCounts = ref<Record<string, number>>({})

onMounted(async () => {
  loading.value = true
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) { toast.error('Please sign in to view messages'); loading.value = false; return }
  vetId.value = authData.user.id
  const { data: profileData, error: profileError } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single()
  if (profileError) { toast.error(profileError.message || 'Failed to verify account role'); loading.value = false; return }
  const currentRole = profileData?.role || 'pet_owner'
  role.value = currentRole
  if (currentRole !== 'vet') { loading.value = false; return }
  const { data: apptData, error: apptError } = await supabase.from('appointments').select('id, pet_owner_id, pet_id, appointment_date, status').eq('vet_id', authData.user.id).in('status', ['confirmed', 'completed']).order('appointment_date', { ascending: false })
  if (apptError) { toast.error(apptError.message || 'Failed to load inbox'); loading.value = false; return }
  const rows = (apptData || []) as AppointmentRow[]
  appointments.value = rows
  if (!rows.length) { loading.value = false; return }
  const petIds = Array.from(new Set(rows.map(r => r.pet_id)))
  const ownerIds = Array.from(new Set(rows.map(r => r.pet_owner_id)))
  const apptIds = rows.map(r => r.id)
  const [{ data: petData }, { data: ownerData }, { data: msgData }] = await Promise.all([
    supabase.from('pets').select('id, name').in('id', petIds),
    supabase.from('profiles').select('id, full_name, email').in('id', ownerIds),
    supabase.from('appointment_messages').select('id, appointment_id').in('appointment_id', apptIds),
  ])
  const pm: Record<string, PetRow> = {}; ((petData || []) as PetRow[]).forEach(p => { pm[p.id] = p })
  const om: Record<string, OwnerRow> = {}; ((ownerData || []) as OwnerRow[]).forEach(o => { om[o.id] = o })
  const cm: Record<string, number> = {}; ((msgData || []) as MessageRow[]).forEach(m => { cm[m.appointment_id] = (cm[m.appointment_id] || 0) + 1 })
  petsById.value = pm; ownersById.value = om; messageCounts.value = cm; loading.value = false
})
</script>

<template>
  <div v-if="loading" class="max-w-5xl mx-auto p-4"><AppCard><p class="pw-subtext">Loading messages...</p></AppCard></div>
  <div v-else-if="role !== 'vet'" class="max-w-5xl mx-auto p-4"><AppCard><h2 class="text-2xl font-bold text-[#191D3A] mb-2">Messages</h2><p class="pw-subtext">This page is available for veterinarian accounts only.</p></AppCard></div>
  <div v-else class="max-w-5xl mx-auto p-4 space-y-6">
    <AppCard>
      <h2 class="text-3xl font-bold text-[#191D3A] mb-2">Vet Messages</h2>
      <p class="pw-subtext">View and respond to appointment messages from pet owners.</p>
    </AppCard>
    <AppCard>
      <p v-if="appointments.length === 0" class="pw-subtext">No approved appointments available for messaging yet.</p>
      <div v-else class="space-y-4">
        <div v-for="appt in appointments" :key="appt.id" class="rounded-xl border border-[#C9BEFF] bg-white/80 p-4">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="font-semibold text-[#191D3A]">Pet Owner: {{ ownersById[appt.pet_owner_id]?.full_name?.trim() || ownersById[appt.pet_owner_id]?.email || 'Owner' }}</p>
              <p class="text-sm pw-subtext mt-1">Pet: {{ petsById[appt.pet_id]?.name || 'Pet' }} | Appointment: {{ new Date(appt.appointment_date).toLocaleString() }}</p>
            </div>
            <span class="self-start rounded-full bg-[#C9BEFF] px-3 py-1 text-xs font-semibold text-[#24274A]">Messages: {{ messageCounts[appt.id] || 0 }}</span>
          </div>
          <AppointmentMessageThread :appointmentId="appt.id" :currentUserId="vetId" :canMessage="appt.status === 'confirmed' || appt.status === 'completed'" />
        </div>
      </div>
    </AppCard>
  </div>
</template>
