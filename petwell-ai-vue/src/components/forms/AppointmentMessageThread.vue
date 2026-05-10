<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { supabase } from '@/lib/supabase'
import AppButton from '@/components/ui/AppButton.vue'

interface AppointmentMessageRow { id: string; appointment_id: string; sender_id: string; message: string; created_at: string }
interface SenderRow { id: string; full_name: string | null; email: string }

const props = defineProps<{ appointmentId: string; currentUserId: string | null; canMessage: boolean }>()

const toast = useToast()
const loading = ref(false)
const sending = ref(false)
const messageInput = ref('')
const messages = ref<AppointmentMessageRow[]>([])
const sendersById = ref<Record<string, SenderRow>>({})

const canSend = computed(() => Boolean(props.currentUserId && props.canMessage && messageInput.value.trim().length > 0))

const loadMessages = async () => {
  if (!props.appointmentId) return
  loading.value = true
  const { data, error } = await supabase.from('appointment_messages')
    .select('id, appointment_id, sender_id, message, created_at')
    .eq('appointment_id', props.appointmentId).order('created_at', { ascending: true })
  if (error) { toast.error(error.message || 'Failed to load messages'); messages.value = []; sendersById.value = {}; loading.value = false; return }
  const rows = (data || []) as AppointmentMessageRow[]
  messages.value = rows
  if (props.currentUserId) {
    await supabase.from('notifications').update({ is_read: true })
      .eq('recipient_id', props.currentUserId).eq('appointment_id', props.appointmentId).eq('is_read', false)
  }
  const senderIds = Array.from(new Set(rows.map(r => r.sender_id)))
  if (!senderIds.length) { sendersById.value = {}; loading.value = false; return }
  const { data: senderData, error: senderError } = await supabase.from('profiles').select('id, full_name, email').in('id', senderIds)
  if (senderError) { toast.error(senderError.message || 'Failed to load sender details'); sendersById.value = {}; loading.value = false; return }
  const map: Record<string, SenderRow> = {}
  ;((senderData || []) as SenderRow[]).forEach(s => { map[s.id] = s })
  sendersById.value = map
  loading.value = false
}

const handleSendMessage = async () => {
  const text = messageInput.value.trim()
  if (!props.currentUserId) { toast.error('Please sign in to send messages'); return }
  if (!props.canMessage) { toast.error('Messaging is available after appointment approval'); return }
  if (!text) return
  sending.value = true
  const { error } = await supabase.from('appointment_messages').insert([{ appointment_id: props.appointmentId, sender_id: props.currentUserId, message: text }])
  if (error) { toast.error(error.message || 'Failed to send message'); sending.value = false; return }
  messageInput.value = ''
  await loadMessages()
  sending.value = false
}

onMounted(() => { loadMessages() })
</script>

<template>
  <div class="mt-4 rounded-xl border border-[#C9BEFF] bg-white/70 p-4">
    <div class="mb-3 flex items-center justify-between gap-3">
      <h4 class="text-sm font-bold text-[#191D3A]">Appointment Messages</h4>
      <button type="button" class="text-xs font-semibold text-[#6367FF] hover:underline" @click="loadMessages">Refresh</button>
    </div>

    <p v-if="loading" class="text-sm pw-subtext">Loading messages...</p>
    <p v-else-if="messages.length === 0" class="text-sm pw-subtext">No messages yet.</p>
    <div v-else class="space-y-2 max-h-56 overflow-y-auto pr-1">
      <div v-for="item in messages" :key="item.id" :class="['flex', item.sender_id === currentUserId ? 'justify-end' : 'justify-start']">
        <div :class="['max-w-[85%] rounded-lg px-3 py-2 text-sm', item.sender_id === currentUserId ? 'bg-[#8494FF] text-white' : 'bg-[#FFDBFD] text-[#24274A]']">
          <p class="mb-1 text-xs font-semibold opacity-90">{{ sendersById[item.sender_id]?.full_name?.trim() || sendersById[item.sender_id]?.email || 'User' }}</p>
          <p>{{ item.message }}</p>
          <p class="mt-1 text-[11px] opacity-80">{{ new Date(item.created_at).toLocaleString() }}</p>
        </div>
      </div>
    </div>

    <div class="mt-3 space-y-2">
      <textarea
        v-model="messageInput"
        class="w-full rounded-lg border border-[#C9BEFF] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8494FF]/60"
        :rows="3"
        :placeholder="canMessage ? 'Type your message...' : 'Messaging unlocks after vet approval'"
        :disabled="!canMessage"
      />
      <AppButton size="sm" variant="primary" @click="handleSendMessage" :loading="sending" :disabled="!canSend">Send Message</AppButton>
    </div>
  </div>
</template>
