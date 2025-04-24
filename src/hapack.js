import { defineCustomElement } from 'vue'
import App from './App.vue'
import I18nHost from './components/I18nHost.vue'
import HaVueCard from "./components/ha-vue-card.vue";

HaVueCard.observedAttributes = ['hass', 'config'];

console.log('[hapack] 开始初始化面板组件');
// 创建i18n实例
// https://vue-i18n.intlify.dev/guide/advanced/wc.html#web-components
const I18nHostElement = defineCustomElement(I18nHost)
customElements.define('i18n-host', I18nHostElement)
const HaVueCardElement = defineCustomElement(HaVueCard)
customElements.define('ha-vue-card', HaVueCardElement)
// 定义需要观察的属性


// 将Vue组件转换为Web Component
const AeccHaPanel = defineCustomElement(App);
customElements.define('aecc-ha-panel', AeccHaPanel);
// 注册面板组件
console.log('[hapack] 注册面板组件 aecc-ha-panel');
console.log('[hapack] 面板组件注册完成');
