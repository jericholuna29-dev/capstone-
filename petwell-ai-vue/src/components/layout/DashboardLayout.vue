<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useToast } from 'vue-toastification'

const router = useRouter()
const route = useRoute()
const toast = useToast()

type UserRole = 'pet_owner' | 'vet' | null

const mobileMenuOpen = ref(false)
const role = ref<UserRole>(null)
const userId = ref<string | null>(null)
const unreadNotifications = ref(0)
const isLoggingOut = ref(false)

interface NavItem {
  href: string
  label: string
  badgeCount?: number
}

const navLinks = computed<NavItem[]>(() => {
  if (role.value === 'vet') {
    return [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/appointments', label: 'Appointment Schedule' },
      { href: '/messages', label: 'Messages' },
      { href: '/notifications', label: 'Notifications', badgeCount: unreadNotifications.value },
      { href: '/profile', label: 'Profile' },
    ]
  }
  return [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/consultation', label: 'Consultation' },
    { href: '/appointments', label: 'Appointments' },
    { href: '/messages', label: 'Messages' },
    { href: '/notifications', label: 'Notifications', badgeCount: unreadNotifications.value },
    { href: '/profile', label: 'Profile' },
  ]
})

const isActiveLink = (href: string) => {
  if (href === '/dashboard') return route.path === href
  return route.path === href || route.path.startsWith(`${href}/`)
}

const loadUnreadNotifications = async () => {
  if (!userId.value) { unreadNotifications.value = 0; return }
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId.value)
    .eq('is_read', false)
  if (!error) unreadNotifications.value = count || 0
}

const handleLogout = async () => {
  if (isLoggingOut.value) return
  isLoggingOut.value = true
  const { error } = await supabase.auth.signOut()
  if (error) {
    toast.error(error.message || 'Failed to log out')
    isLoggingOut.value = false
    return
  }
  toast.success('Logged out successfully')
  router.push('/auth/login')
  isLoggingOut.value = false
}

let interval: ReturnType<typeof setInterval>

onMounted(async () => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const uid = sessionData.session?.user?.id
  if (sessionError || !uid) { role.value = 'pet_owner'; return }
  userId.value = uid
  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', uid).single()
  role.value = (profileData?.role as UserRole) || 'pet_owner'
  await loadUnreadNotifications()
  interval = setInterval(loadUnreadNotifications, 30000)
})

onUnmounted(() => { clearInterval(interval) })
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-[#FFDBFD] via-[#C9BEFF]/70 to-[#8494FF]/25">
    <!-- Navigation -->
    <nav class="sticky top-0 z-30 border-b border-[#C9BEFF]/70 bg-white/78 shadow-[0_8px_30px_rgba(99,103,255,0.08)] backdrop-blur-xl">
      <div class="max-w-7xl mx-auto px-4 py-3 md:py-4">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <img src="/Petwellai.svg" alt="Petwell AI logo" class="h-12 w-12 md:h-14 md:w-14" />
            <div>
              <h1 class="text-xl md:text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#8494FF] to-[#6367FF]">
                Petwell AI
              </h1>
              <p class="hidden md:block text-xs font-semibold uppercase tracking-[0.16em] text-[#5E6288]">
                Care Platform
              </p>
            </div>
          </div>

          <!-- Desktop nav -->
          <div class="hidden md:flex items-center gap-2 rounded-2xl border border-[#C9BEFF]/80 bg-white/65 px-2 py-2 text-sm md:text-base">
            <RouterLink
              v-for="link in navLinks"
              :key="link.href"
              :to="link.href"
              :class="[
                'relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200',
                isActiveLink(link.href)
                  ? 'bg-gradient-to-r from-[#8494FF] to-[#6367FF] text-white shadow-[0_8px_18px_rgba(99,103,255,0.28)]'
                  : 'text-[#24274A]/80 hover:bg-[#FFDBFD] hover:text-[#6367FF]'
              ]"
            >
              {{ link.label }}
              <span
                v-if="link.badgeCount"
                :class="[
                  'rounded-full px-2 py-0.5 text-[11px] font-bold',
                  isActiveLink(link.href) ? 'bg-white/25 text-white' : 'bg-[#6367FF] text-white'
                ]"
              >{{ link.badgeCount }}</span>
            </RouterLink>
            <button
              class="ml-1 rounded-xl border border-[#C9BEFF] bg-white px-3 py-2 text-sm font-semibold text-[#24274A] transition-all duration-200 hover:border-[#8494FF] hover:text-[#6367FF] disabled:opacity-60"
              @click="handleLogout"
              :disabled="isLoggingOut"
            >
              {{ isLoggingOut ? 'Logging out...' : 'Logout' }}
            </button>
          </div>

          <!-- Mobile hamburger -->
          <button
            type="button"
            class="relative md:hidden inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#C9BEFF] bg-white/85 text-[#24274A] transition-all duration-200 hover:bg-[#FFDBFD]"
            @click="mobileMenuOpen = !mobileMenuOpen"
            :aria-expanded="mobileMenuOpen"
            :aria-label="mobileMenuOpen ? 'Close dashboard navigation' : 'Open dashboard navigation'"
          >
            <span v-if="unreadNotifications > 0" class="absolute -right-1 -top-1 rounded-full bg-[#6367FF] px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
              {{ unreadNotifications > 99 ? '99+' : unreadNotifications }}
            </span>
            <span class="flex h-4 w-5 flex-col justify-between">
              <span :class="['h-0.5 w-5 rounded-full bg-current transition-all duration-200', mobileMenuOpen ? 'translate-y-[7px] rotate-45' : '']" />
              <span :class="['h-0.5 w-5 rounded-full bg-current transition-all duration-200', mobileMenuOpen ? 'opacity-0' : 'opacity-100']" />
              <span :class="['h-0.5 w-5 rounded-full bg-current transition-all duration-200', mobileMenuOpen ? '-translate-y-[7px] -rotate-45' : '']" />
            </span>
          </button>
        </div>

        <!-- Mobile menu -->
        <div v-if="mobileMenuOpen" class="mt-3 md:hidden rounded-2xl border border-[#C9BEFF] bg-white p-3 shadow-[0_14px_30px_rgba(99,103,255,0.16)]">
          <div class="mb-2 px-2">
            <p class="text-xs font-bold uppercase tracking-[0.16em] text-[#6367FF]">Menu</p>
            <p class="text-xs text-[#5E6288]">Quick navigation</p>
          </div>
          <div class="overflow-hidden rounded-xl border border-[#E2DDFF] bg-[#FCFBFF]">
            <RouterLink
              v-for="(link, index) in navLinks"
              :key="link.href"
              :to="link.href"
              :class="[
                'flex items-center justify-between px-3 py-3 text-sm font-semibold transition-colors duration-200',
                isActiveLink(link.href) ? 'bg-[#E7E2FF] text-[#3F45A2]' : 'text-[#24274A] hover:bg-[#F4F1FF]',
                index !== navLinks.length - 1 ? 'border-b border-[#ECE9FF]' : ''
              ]"
              @click="mobileMenuOpen = false"
            >
              <span>{{ link.label }}</span>
              <span class="flex items-center gap-2">
                <span v-if="link.badgeCount" class="rounded-full bg-[#6367FF] px-2 py-0.5 text-[10px] font-bold text-white">{{ link.badgeCount }}</span>
                <span class="text-xs text-[#8C8FB8]">&gt;</span>
              </span>
            </RouterLink>
          </div>
          <button
            class="mt-2 w-full rounded-lg bg-gradient-to-r from-[#8494FF] to-[#6367FF] px-3 py-2 text-sm font-semibold text-white transition-all duration-200 hover:brightness-105 hover:shadow-[0_10px_20px_rgba(99,103,255,0.24)] disabled:opacity-60"
            @click="handleLogout"
            :disabled="isLoggingOut"
          >
            {{ isLoggingOut ? 'Logging out...' : 'Logout' }}
          </button>
        </div>
      </div>
    </nav>

    <!-- Main content -->
    <main class="max-w-7xl mx-auto p-4 md:p-6">
      <slot />
    </main>
  </div>
</template>
