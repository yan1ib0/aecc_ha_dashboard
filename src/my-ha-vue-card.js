import { defineCustomElement } from 'vue'
import HaVueCard from './components/ha-vue-card.vue'

console.log('[my-ha-vue-card] 开始初始化面板组件');

// 定义需要观察的属性
HaVueCard.observedAttributes = ['hass', 'config'];

// 将Vue组件转换为Web Component
const HaVueCardElement = defineCustomElement(HaVueCard)

// 注册面板组件
console.log('[my-ha-vue-card] 注册面板组件 vue-card-panel');
customElements.define('vue-card-panel', HaVueCardElement)

console.log('[my-ha-vue-card] 面板组件注册完成');

// 导出面板组件
class VueCardPanel extends HTMLElement {
  constructor() {
    super();
    this._panel = null;
  }

  set panel(panel) {
    this._panel = panel;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(this._panel);
  }

  connectedCallback() {
    console.log('[vue-card-panel] 面板已连接');
  }

  disconnectedCallback() {
    console.log('[vue-card-panel] 面板已断开连接');
  }
}

customElements.define('vue-card-panel-element', VueCardPanel);
export { VueCardPanel }