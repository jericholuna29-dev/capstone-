<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'

const features = [
  { title: 'AI Symptom Analysis', text: 'Receive structured insights with severity guidance in seconds.' },
  { title: 'Owner and Vet Dashboards', text: 'Role-based workflows keep records, appointments, and updates organized.' },
  { title: 'My Pet Management', text: 'Maintain complete profiles for every pet with editable details.' },
]

const stats = [
  { metric: '24/7', label: 'Access to digital triage support' },
  { metric: '2 Roles', label: 'Purpose-built owner and vet interfaces' },
  { metric: 'Fast', label: 'Clear flow from symptom to booking' },
]
</script>

<template>
  <div class="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#FFDBFD] via-[#C9BEFF]/75 to-[#8494FF]/45 text-[#24274A]">
    <div class="pointer-events-none absolute -left-24 -top-20 h-72 w-72 rounded-full bg-[#FFDBFD]/85 blur-3xl" />
    <div class="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[#8494FF]/30 blur-3xl" />

    <header class="relative mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 md:gap-3">
          <img src="/Petwellai.svg" alt="Petwell AI logo" class="h-14 w-14 md:h-16 md:w-16" />
          <h1 class="text-2xl md:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#6367FF] to-[#8494FF]">
            Petwell AI
          </h1>
        </div>
        <div class="flex items-center gap-2">
          <RouterLink to="/auth/login">
            <AppButton variant="secondary" size="sm">Sign In</AppButton>
          </RouterLink>
          <RouterLink to="/auth/register">
            <AppButton variant="primary" size="sm">Get Started</AppButton>
          </RouterLink>
        </div>
      </div>
    </header>

    <main class="relative mx-auto w-full max-w-7xl px-4 pb-12 md:px-8 md:pb-20">
      <section class="grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-stretch">
        <AppCard class="p-6 md:p-10 bg-gradient-to-br from-white/88 to-[#FFDBFD]/72 border-[#C9BEFF]">
          <p class="pw-chip mb-4 uppercase tracking-[0.18em]">Intelligent Veterinary Assistance</p>
          <h2 class="pw-heading max-w-2xl text-2xl font-black leading-tight sm:text-3xl md:text-5xl lg:text-6xl">
            Professional Pet Health Support,
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-[#8494FF] to-[#6367FF]"> Designed for Daily Care</span>
          </h2>
          <p class="pw-subtext mt-5 max-w-2xl text-base md:text-lg">
            Petwell AI helps pet owners and veterinary teams with accurate triage summaries,
            faster appointment coordination, and clear consultation records in one modern workspace.
          </p>
        </AppCard>

        <AppCard class="p-7 md:p-8 bg-gradient-to-br from-[#C9BEFF]/65 to-white/85 border-[#8494FF]/40">
          <h3 class="pw-heading text-xl">At a Glance</h3>
          <div class="mt-5 space-y-4">
            <div v-for="item in features" :key="item.title" class="pw-section-card">
              <p class="pw-heading font-semibold">{{ item.title }}</p>
              <p class="pw-subtext mt-1 text-sm">{{ item.text }}</p>
            </div>
          </div>
        </AppCard>
      </section>

      <section class="mt-6 grid gap-4 md:grid-cols-3">
        <AppCard v-for="item in stats" :key="item.metric" class="bg-gradient-to-r from-[#FFDBFD]/80 to-white/75 p-5">
          <p class="pw-stat-number text-2xl">{{ item.metric }}</p>
          <p class="pw-subtext mt-1 text-sm">{{ item.label }}</p>
        </AppCard>
      </section>
    </main>
  </div>
</template>
