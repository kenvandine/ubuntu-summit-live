// Service worker registration, update prompt and install prompt state.

import { registerSW } from 'virtual:pwa-register'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

class Pwa {
  needRefresh = $state(false)
  canInstall = $state(false)

  private updateSW: ((reload?: boolean) => Promise<void>) | null = null
  private installEvent: BeforeInstallPromptEvent | null = null

  init() {
    this.updateSW = registerSW({
      onNeedRefresh: () => (this.needRefresh = true),
    })

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      this.installEvent = e as BeforeInstallPromptEvent
      this.canInstall = true
    })
    window.addEventListener('appinstalled', () => {
      this.installEvent = null
      this.canInstall = false
    })
  }

  async install() {
    if (!this.installEvent) return
    await this.installEvent.prompt()
    await this.installEvent.userChoice
    this.installEvent = null
    this.canInstall = false
  }

  update() {
    this.updateSW?.(true)
  }

  dismiss() {
    this.needRefresh = false
  }
}

export const pwa = new Pwa()
