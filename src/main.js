import {createApp, defineCustomElement} from 'vue'
import './style.css'
import App from './App.vue'
import I18nHost from './components/I18nHost.vue'

const I18nHostElement = defineCustomElement(I18nHost)

customElements.define('i18n-host', I18nHostElement)
const app = createApp(App);

app.mount('#app')
