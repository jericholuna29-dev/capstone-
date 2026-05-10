<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import AppCard from '@/components/ui/AppCard.vue'
import AppButton from '@/components/ui/AppButton.vue'

interface ConsultationHistoryEntry {
  id: string
  createdAt: string
  petName: string
  petType: 'dog' | 'cat'
  petAge: number
  symptoms: string
  result: { severity: 'low' | 'medium' | 'high' }
}

const CONSULTATION_HISTORY_KEY = 'petwell_consultation_history_v1'

const router = useRouter()
const toast = useToast()
const consultationHistory = ref<ConsultationHistoryEntry[]>([])

onMounted(() => {
  try {
    const raw = window.localStorage.getItem(CONSULTATION_HISTORY_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as ConsultationHistoryEntry[]
    if (Array.isArray(parsed)) consultationHistory.value = parsed
  } catch {
    window.localStorage.removeItem(CONSULTATION_HISTORY_KEY)
  }
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="pw-heading text-3xl mb-2">Welcome Back</h2>
      <p class="pw-subtext">Manage your pets and consultations</p>
    </div>

    <AppCard>
      <h3 class="text-xl font-bold text-[#191D3A] mb-4">Quick Actions</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RouterLink to="/consultation"><AppButton variant="primary" class="w-full">New Consultation</AppButton></RouterLink>
        <RouterLink to="/pets/add"><AppButton variant="secondary" class="w-full">Add Pet</AppButton></RouterLink>
        <RouterLink to="/appointments"><AppButton variant="secondary" class="w-full">View Appointments</AppButton></RouterLink>
      </div>
    </AppCard>

    <AppCard>
      <h3 class="text-lg font-bold text-[#191D3A] mb-3">Recent Consultations</h3>
      <div v-if="consultationHistory.length === 0" class="text-center py-4">
        <p class="pw-subtext">No consultations yet</p>
      </div>
      <div v-else class="space-y-3">
        <div
          v-for="(item, idx) in consultationHistory.slice(0, 5)"
          :key="idx"
          class="flex items-center justify-between rounded-lg bg-white/50 p-3 border border-[#E0D5FF]"
        >
          <div>
            <p class="font-semibold text-[#191D3A]">{{ item.petName }}</p>
            <p class="text-xs pw-subtext">{{ item.symptoms }}</p>
          </div>
          <span
            :class="{
              'bg-green-100 text-green-700': item.result.severity === 'low',
              'bg-yellow-100 text-yellow-700': item.result.severity === 'medium',
              'bg-red-100 text-red-700': item.result.severity === 'high',
            }"
            class="px-2 py-1 rounded text-xs font-semibold"
          >
            {{ item.result.severity }}
          </span>
        </div>
      </div>
    </AppCard>
  </div>
</template>
