<script setup lang="ts">
interface Props {
  label?: string
  error?: string
  modelValue?: string | number
}

defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
defineOptions({ inheritAttrs: false })
</script>

<template>
  <div class="w-full">
    <label v-if="label" class="block text-sm sm:text-base font-medium text-[#2B2F66] mb-2">
      {{ label }}
    </label>
    <input
      :value="modelValue"
      :class="[
        'w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-[#C9BEFF] rounded-lg hover:border-[#8494FF]/70 focus:outline-none focus:ring-2 focus:ring-[#8494FF]/60 focus:border-transparent transition-all',
        error ? 'border-[#D64B7E] focus:ring-[#D64B7E]/40 hover:border-[#D64B7E]' : '',
        $attrs.class,
      ]"
      v-bind="{ ...$attrs, class: undefined }"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <p v-if="error" class="text-[#D64B7E] text-sm mt-1">{{ error }}</p>
  </div>
</template>
