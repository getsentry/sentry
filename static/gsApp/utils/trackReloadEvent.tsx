import {ConfigStore} from 'sentry/stores/configStore';

export function trackReloadEvent(eventType: string, data: Record<PropertyKey, unknown>) {
  // quit early if analytics is disabled
  if (!ConfigStore.get('enableAnalytics')) {
    return;
  }
  window.ra?.event(eventType, data);
}
