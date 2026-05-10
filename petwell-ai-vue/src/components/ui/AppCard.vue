<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>

<template>
  <div
    :class="[
      'bg-white/85 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-[0_12px_30px_rgba(99,103,255,0.12)] p-4 sm:p-6 border border-[#C9BEFF]/70 transition-shadow duration-200 pw-interactive',
      $attrs.class,
    ]"
    v-bind="{ ...$attrs, class: undefined }"
  >
    <slot />
  </div>
</template>
