<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  type: 'button',
})

const variants = {
  primary: 'bg-[#6367FF] text-white hover:bg-[#5257f5] hover:shadow-[0_10px_22px_rgba(99,103,255,0.28)]',
  secondary: 'bg-[#C9BEFF] text-[#24274A] hover:bg-[#b7a8ff] hover:shadow-[0_10px_20px_rgba(132,148,255,0.22)]',
  danger: 'bg-[#D64B7E] text-white hover:bg-[#c13f6f] hover:shadow-[0_10px_20px_rgba(214,75,126,0.25)]',
}

const sizes = {
  sm: 'px-3 py-2 text-sm min-h-9',
  md: 'px-4 py-2.5 text-base min-h-10',
  lg: 'px-6 py-3 text-lg min-h-11 sm:min-h-12',
}
</script>

<template>
  <button
    :type="type"
    :class="[
      'font-semibold rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8494FF]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed',
      variants[variant],
      sizes[size],
      $attrs.class,
    ]"
    :disabled="disabled || loading"
    v-bind="{ ...$attrs, class: undefined }"
  >
    {{ loading ? 'Loading...' : undefined }}
    <slot v-if="!loading" />
  </button>
</template>
