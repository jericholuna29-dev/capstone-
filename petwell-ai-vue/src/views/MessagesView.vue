<script setup lang="ts">
import { ref, onMounted } from 'vue'
import DashboardLayout from '@/components/layout/DashboardLayout.vue'
import PetOwnerMessagesInbox from '@/components/forms/PetOwnerMessagesInbox.vue'
import VetMessagesInbox from '@/components/forms/VetMessagesInbox.vue'
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
    <VetMessagesInbox v-else-if="role === 'vet'" />
    <PetOwnerMessagesInbox v-else />
  </DashboardLayout>
</template>
