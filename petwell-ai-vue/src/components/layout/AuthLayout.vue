<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-[#FFDBFD] via-[#C9BEFF] to-[#8494FF]/40 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="rounded-3xl border border-[#C9BEFF]/80 bg-white/86 p-6 shadow-[0_20px_60px_rgba(99,103,255,0.2)] backdrop-blur-sm md:p-8">
        <div class="mb-6 text-center">
          <div class="flex items-center justify-center gap-3">
            <img src="/Petwellai.svg" alt="Petwell AI logo" class="h-16 w-16" />
            <h1 class="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#8494FF] to-[#6367FF]">
              Petwell AI
            </h1>
          </div>
          <p class="pw-subtext mt-2 text-sm">Professional Pet Care</p>
        </div>
        <h2 class="mb-6 text-center text-2xl font-bold text-[#191D3A]">{{ title }}</h2>
        <slot />
      </div>
    </div>
  </div>
</template>
