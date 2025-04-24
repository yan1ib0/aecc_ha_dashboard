<script setup>
import HaVueCard from './components/ha-vue-card.vue'
import I18nHost from "./components/I18nHost.vue";
import {ref} from "vue";
import {provide, watchEffect} from 'vue'
import {createI18n, I18nInjectionKey} from 'vue-i18n'

console.log('加载到i18nHost')
const props = defineProps({
  hass: {
    type: Object,
    required: true,
    default: () => ({})
  },
  config: {
    type: Object,
    default: () => ({})
  }
});

let locale = ref('en-US')
//国际化
import en from './locales/en.json'
import zhCN from './locales/zh-CN.json'
const messages = { 'en-US':en, 'zh-CN': zhCN }
const i18n = createI18n({
  legacy: false,
  locale: 'en-US',
  messages
  // messages: {
  //   'en-US': {
  //     'panel': {
  //       'title': 'Hello World',
  //     }
  //   },
  //   'zh-CN': {
  //     'panel': {
  //       'title': '你好世界',
  //     }
  //   }
  // }
})
// 通过 provide 注入 i18n
console.log('I18nInjectionKey', I18nInjectionKey)
console.log('i18n', i18n)
provide(I18nInjectionKey, i18n)
watchEffect(() => {
  i18n.global.locale.value = locale.value
})
</script>

<template>
  <i18n-host>
    <ha-vue-card .locale="locale" .hass='props.hass' .config="props.config"/>
  </i18n-host>
</template>
