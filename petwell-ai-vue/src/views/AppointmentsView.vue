<script setup lang="ts">
import { ref, onMounted } from 'vue'
import DashboardLayout from '@/components/layout/DashboardLayout.vue'
import BookAppointment from '@/components/forms/BookAppointment.vue'
import VetAppointmentSchedule from '@/components/forms/VetAppointmentSchedule.vue'
import AppCard from '@/components/ui/AppCard.vue'
import { supabase } from '@/lib/supabase'

type UserRole = 'pet_owner' | 'vet' | null
const role = ref<UserRole>(null)
const loading = ref(true)

onMounted(async () => {
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user?.id
  if (!userId) { loading.value = false; return }
  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', userId).single()
  role.value = (profileData?.role as UserRole) || 'pet_owner'
  loading.value = false
})
</script>

<template>
  <DashboardLayout>
    <AppCard v-if="loading"><p class="pw-subtext">Loading...</p></AppCard>
    <VetAppointmentSchedule v-else-if="role === 'vet'" />
    <BookAppointment v-else />
  </DashboardLayout>
</template>
