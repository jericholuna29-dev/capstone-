import { createApp } from 'vue'
import Toast, { POSITION, type PluginOptions } from 'vue-toastification'
import 'vue-toastification/dist/index.css'
import router from './router'
import App from './App.vue'
import './assets/globals.css'

const toastOptions: PluginOptions = {
  position: POSITION.TOP_RIGHT,
  timeout: 4000,
}

const app = createApp(App)
app.use(router)
app.use(Toast, toastOptions)
app.mount('#app')
