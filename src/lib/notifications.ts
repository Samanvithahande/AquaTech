import { ApiAlert } from '../types/aquaculture';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

const NOTIFIED_STORAGE_KEY = 'aquaguard_notified_alert_ids';

class NotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null;

  constructor() {
    this.registerServiceWorker();
  }

  /**
   * Register service worker if supported
   */
  async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return null;
    }

    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      this.swRegistration = reg;
      return reg;
    } catch (err) {
      console.warn('Service worker registration error:', err);
      return null;
    }
  }

  /**
   * Check current browser notification permission
   */
  getPermissionState(): NotificationPermissionState {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission as NotificationPermissionState;
  }

  /**
   * Request permission from user gesture (click event)
   */
  async requestPermission(): Promise<NotificationPermissionState> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await this.registerServiceWorker();
      }
      return permission as NotificationPermissionState;
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      return 'denied';
    }
  }

  /**
   * Get set of already notified alert IDs to prevent duplicates
   */
  private getNotifiedIds(): Set<string> {
    try {
      const stored = localStorage.getItem(NOTIFIED_STORAGE_KEY);
      if (!stored) return new Set();
      const list = JSON.parse(stored);
      return new Set(Array.isArray(list) ? list : []);
    } catch {
      return new Set();
    }
  }

  /**
   * Mark alert ID as notified
   */
  private markAsNotified(alertId: string) {
    try {
      const set = this.getNotifiedIds();
      set.add(alertId);
      // Keep only last 200 IDs to avoid unbounded growth
      const array = Array.from(set).slice(-200);
      localStorage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify(array));
    } catch {
      // ignore
    }
  }

  /**
   * Check if alert was already notified
   */
  hasBeenNotified(alertId: string): boolean {
    return this.getNotifiedIds().has(alertId);
  }

  /**
   * Dispatch notification for actual FastAPI alert response
   */
  async notifyAlert(
    alert: ApiAlert,
    language: 'kn' | 'hi' | 'en' = 'kn'
  ): Promise<boolean> {
    if (this.getPermissionState() !== 'granted') {
      return false;
    }

    // Only notify on medium or high risk alerts
    const risk = alert.risk_level?.toLowerCase();
    if (risk !== 'medium' && risk !== 'high') {
      return false;
    }

    // Prevent duplicate notifications for the same alert ID
    if (this.hasBeenNotified(alert.alert_id)) {
      return false;
    }

    // Format localized and English messages
    const enText = alert.message?.en || `${risk.toUpperCase()} risk detected.`;
    const localText =
      language !== 'en' && alert.message
        ? alert.message[language] || alert.message.kn || alert.message.hi
        : null;

    const readableType =
      alert.type === 'water_quality' ? 'Water Quality Alert' : 'Fish Disease Alert';

    const title = `🚨 [${risk.toUpperCase()} RISK] ${readableType} · ${alert.farm_id}`;

    // Notification body containing: farm ID, alert type, risk level, and recommended action
    const bodyLines = [
      localText ? `${localText}` : enText,
      `• Farm / Pond: ${alert.farm_id}`,
      `• Risk Level: ${risk.toUpperCase()}`,
      `• Action: ${alert.recommended_action}`,
    ];

    const body = bodyLines.join('\n');

    const options: NotificationOptions = {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: alert.alert_id, // browser-level duplicate prevention
      requireInteraction: risk === 'high', // Keep high risk visible until user interacts
      data: {
        alert_id: alert.alert_id,
        farm_id: alert.farm_id,
        type: alert.type,
        risk_level: risk,
        recommended_action: alert.recommended_action,
        url: alert.type === 'water_quality' ? '/water-monitoring' : '/disease-detection',
      },
    };

    try {
      // Prefer ServiceWorkerRegistration.showNotification if available
      if (this.swRegistration && 'showNotification' in this.swRegistration) {
        await this.swRegistration.showNotification(title, options);
      } else if ('Notification' in window) {
        const notif = new Notification(title, options);
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      }

      this.markAsNotified(alert.alert_id);
      return true;
    } catch (err) {
      console.error('Failed to display browser notification:', err);
      return false;
    }
  }

  /**
   * Send an immediate test notification to verify browser permissions
   */
  async sendTestNotification(language: 'kn' | 'hi' | 'en' = 'kn'): Promise<boolean> {
    const testAlert: ApiAlert = {
      alert_id: `test-${Date.now()}`,
      farm_id: 'pond_001',
      type: 'water_quality',
      risk_level: 'high',
      message: {
        en: 'HIGH RISK: Turn on the aerator immediately.',
        kn: 'HIGH ಅಪಾಯ: ತಕ್ಷಣ ಏರೇಟರ್ ಆನ್ ಮಾಡಿ.',
        hi: 'HIGH जोखिम: अभी एरेटर चालू करें।',
      },
      recommended_action: 'Turn on the aerator immediately and inspect pond dissolved oxygen',
      created_at: new Date().toISOString(),
      is_demo: false,
    };

    return await this.notifyAlert(testAlert, language);
  }
}

export const notificationService = new NotificationService();
