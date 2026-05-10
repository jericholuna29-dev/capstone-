<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { supabase } from '@/lib/supabase'
import AppCard from '@/components/ui/AppCard.vue'
import AppButton from '@/components/ui/AppButton.vue'

interface NotificationRow { id: string; recipient_id: string; appointment_id: string | null; notification_type: 'new_message'|'appointment_request'|'appointment_update'; title: string; body: string; is_read: boolean; created_at: string }

const router = useRouter()
const toast = useToast()
const loading = ref(true)
const updating = ref(false)
const userId = ref<string | null>(null)
const notifications = ref<NotificationRow[]>([])

const unreadCount = computed(() => notifications.value.filter(n => !n.is_read).length)

const loadNotifications = async (recipientId?: string) => {
  const target = recipientId || userId.value
  if (!target) return
  loading.value = true
  const { data, error } = await supabase.from('notifications').select('id, recipient_id, appointment_id, notification_type, title, body, is_read, created_at').eq('recipient_id', target).order('created_at', { ascending: false }).limit(100)
  if (error) { toast.error(error.message || 'Failed to load notifications'); notifications.value = []; loading.value = false; return }
  notifications.value = (data || []) as NotificationRow[]
  loading.value = false
}

const markOneAsRead = async (id: string) => {
  if (!userId.value) return
  updating.value = true
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('recipient_id', userId.value)
  if (error) { toast.error(error.message || 'Failed to update notification'); updating.value = false; return }
  notifications.value = notifications.value.map(n => n.id === id ? { ...n, is_read: true } : n)
  updating.value = false
}

const markAllAsRead = async () => {
  if (!userId.value) return
  const unreadIds = notifications.value.filter(n => !n.is_read).map(n => n.id)
  if (!unreadIds.length) return
  updating.value = true
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', userId.value).in('id', unreadIds)
  if (error) { toast.error(error.message || 'Failed to mark all as read'); updating.value = false; return }
  notifications.value = notifications.value.map(n => ({ ...n, is_read: true }))
  updating.value = false; toast.success('All notifications marked as read')
}

const getNotificationTarget = (item: NotificationRow) => item.notification_type === 'new_message' ? '/messages' : '/appointments'

const openNotification = async (item: NotificationRow) => {
  if (!item.is_read) await markOneAsRead(item.id)
  router.push(getNotificationTarget(item))
}

onMounted(async () => {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) { toast.error('Please sign in to view notifications'); loading.value = false; return }
  userId.value = authData.user.id
  await loadNotifications(authData.user.id)
})
</script>

<template>
  <div class="max-w-4xl mx-auto p-4 space-y-6">
    <AppCard>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-3xl font-bold text-[#191D3A]">Notifications</h2>
          <p class="pw-subtext mt-1">Stay updated with new appointment messages.</p>
        </div>
        <AppButton variant="secondary" size="sm" :disabled="updating || unreadCount === 0" @click="markAllAsRead">Mark All Read ({{ unreadCount }})</AppButton>
      </div>
    </AppCard>
    <AppCard>
      <p v-if="loading" class="pw-subtext">Loading notifications...</p>
      <p v-else-if="notifications.length === 0" class="pw-subtext">No notifications yet.</p>
      <div v-else class="space-y-3">
        <div v-for="item in notifications" :key="item.id" :class="['rounded-xl border p-4', item.is_read ? 'border-[#D8D4F6] bg-white/70' : 'border-[#8494FF] bg-gradient-to-br from-[#FFDBFD] to-white']">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p class="font-semibold text-[#191D3A]">{{ item.title }}</p>
              <p class="text-sm text-[#32375D] mt-1">{{ item.body }}</p>
              <p class="text-xs pw-subtext mt-2">{{ new Date(item.created_at).toLocaleString() }}</p>
            </div>
            <div class="flex gap-2 flex-wrap">
              <AppButton v-if="!item.is_read" variant="primary" size="sm" :disabled="updating" @click="markOneAsRead(item.id)">Mark Read</AppButton>
              <AppButton variant="secondary" size="sm" :disabled="updating" @click="openNotification(item)">Open</AppButton>
            </div>
          </div>
        </div>
      </div>
    </AppCard>
  </div>
</template>
