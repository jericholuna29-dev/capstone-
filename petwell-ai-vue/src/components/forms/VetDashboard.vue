<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { supabase } from '@/lib/supabase'
import AppCard from '@/components/ui/AppCard.vue'
import AppButton from '@/components/ui/AppButton.vue'

interface AppointmentRow {
  id: string; pet_owner_id: string; pet_id: string; appointment_date: string
  appointment_type: string | null; status: 'pending' | 'confirmed' | 'completed' | 'cancelled'; notes: string | null
}
interface PetRow { id: string; name: string; species: string }
interface OwnerRow { id: string; full_name: string | null; email: string }

const toast = useToast()
const loading = ref(true)
const vetId = ref<string | null>(null)
const updatingId = ref<string | null>(null)
const appointments = ref<AppointmentRow[]>([])
const petsById = ref<Record<string, PetRow>>({})
const ownersById = ref<Record<string, OwnerRow>>({})

const todayLabel = new Date().toLocaleDateString()

const pendingAppointments = computed(() => appointments.value.filter(a => a.status === 'pending').slice(0, 5))
const todayAppointments = computed(() => appointments.value.filter(a => a.status !== 'cancelled' && new Date(a.appointment_date).toLocaleDateString() === todayLabel).slice(0, 6))

onMounted(async () => {
  loading.value = true
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) { toast.error('Please sign in to view veterinarian dashboard'); loading.value = false; return }
  vetId.value = authData.user.id
  const { data: apptData, error: apptError } = await supabase.from('appointments')
    .select('id, pet_owner_id, pet_id, appointment_date, appointment_type, status, notes')
    .eq('vet_id', authData.user.id).order('appointment_date', { ascending: true })
  if (apptError) { toast.error(apptError.message || 'Failed to load dashboard'); loading.value = false; return }
  const rows = (apptData || []) as AppointmentRow[]
  appointments.value = rows

  if (!rows.length) { loading.value = false; return }
  const petIds = Array.from(new Set(rows.map(r => r.pet_id)))
  const ownerIds = Array.from(new Set(rows.map(r => r.pet_owner_id)))
  const [{ data: petData }, { data: ownerData }] = await Promise.all([
    supabase.from('pets').select('id, name, species').in('id', petIds),
    supabase.from('profiles').select('id, full_name, email').in('id', ownerIds),
  ])
  const pm: Record<string, PetRow> = {}
  ;((petData || []) as PetRow[]).forEach(p => { pm[p.id] = p })
  const om: Record<string, OwnerRow> = {}
  ;((ownerData || []) as OwnerRow[]).forEach(o => { om[o.id] = o })
  petsById.value = pm; ownersById.value = om; loading.value = false
})

const handleStatusUpdate = async (appointmentId: string, nextStatus: 'confirmed' | 'cancelled') => {
  if (!vetId.value) { toast.error('Unable to verify veterinarian account'); return }
  updatingId.value = appointmentId
  const { data: updatedRow, error } = await supabase.from('appointments').update({ status: nextStatus })
    .eq('id', appointmentId).select('id, status').maybeSingle()
  if (error) { toast.error(error.message || 'Failed to update'); updatingId.value = null; return }
  if (!updatedRow) { toast.error('Appointment not found.'); updatingId.value = null; return }
  appointments.value = appointments.value.map(a => a.id === appointmentId ? { ...a, status: nextStatus } : a)
  toast.success(nextStatus === 'confirmed' ? 'Appointment approved' : 'Appointment declined')
  updatingId.value = null
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="pw-heading text-3xl mb-2">Veterinarian Dashboard</h2>
      <p class="pw-subtext">Manage your appointments and patients</p>
    </div>

    <div v-if="loading" class="grid grid-cols-1 gap-4">
      <AppCard><p class="pw-subtext text-center py-8">Loading your dashboard...</p></AppCard>
    </div>

    <AppCard>
      <div class="flex items-center justify-between mb-4 gap-3">
        <h3 class="text-xl font-bold text-[#191D3A]">Pending Approval Requests</h3>
        <RouterLink to="/appointments" class="text-sm font-semibold text-[#6367FF] hover:underline">View Full Schedule</RouterLink>
      </div>
      <p v-if="pendingAppointments.length === 0" class="pw-subtext">No pending requests.</p>
      <div v-else class="space-y-4">
        <div v-for="appt in pendingAppointments" :key="appt.id" class="rounded-xl border border-[#C9BEFF] bg-white/80 p-4">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p class="font-semibold text-[#191D3A]">{{ new Date(appt.appointment_date).toLocaleString() }}</p>
              <p class="text-sm pw-subtext mt-1">Pet: {{ petsById[appt.pet_id]?.name || 'Pet' }}{{ petsById[appt.pet_id]?.species ? ` (${petsById[appt.pet_id].species})` : '' }}</p>
              <p class="text-sm pw-subtext">Owner: {{ ownersById[appt.pet_owner_id]?.full_name?.trim() || ownersById[appt.pet_owner_id]?.email || 'Unknown' }}</p>
            </div>
            <div class="flex gap-2">
              <AppButton
                size="sm"
                variant="primary"
                :disabled="updatingId === appt.id"
                @click="handleStatusUpdate(appt.id, 'confirmed')"
              >
                {{ updatingId === appt.id ? '...' : 'Approve' }}
              </AppButton>
              <AppButton
                size="sm"
                variant="secondary"
                :disabled="updatingId === appt.id"
                @click="handleStatusUpdate(appt.id, 'cancelled')"
              >
                {{ updatingId === appt.id ? '...' : 'Decline' }}
              </AppButton>
            </div>
          </div>
        </div>
      </div>
    </AppCard>

    <AppCard>
      <h3 class="text-xl font-bold text-[#191D3A] mb-4">Today's Appointments</h3>
      <p v-if="todayAppointments.length === 0" class="pw-subtext">No appointments today.</p>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="appt in todayAppointments"
          :key="appt.id"
          class="rounded-xl border border-[#C9BEFF] bg-gradient-to-br from-[#F5F1FF] to-white p-4"
        >
          <div class="flex items-start justify-between">
            <div>
              <p class="font-semibold text-[#191D3A]">{{ new Date(appt.appointment_date).toLocaleTimeString() }}</p>
              <p class="text-sm pw-subtext mt-1">{{ petsById[appt.pet_id]?.name || 'Pet' }}</p>
              <p class="text-xs pw-subtext">{{ ownersById[appt.pet_owner_id]?.full_name?.trim() || 'Unknown Owner' }}</p>
            </div>
            <span
              :class="{
                'bg-yellow-100 text-yellow-700': appt.status === 'pending',
                'bg-green-100 text-green-700': appt.status === 'confirmed',
                'bg-blue-100 text-blue-700': appt.status === 'completed',
              }"
              class="px-2 py-1 rounded text-xs font-semibold"
            >
              {{ appt.status }}
            </span>
          </div>
        </div>
      </div>
    </AppCard>
  </div>
</template>
