import ConfigStore from 'sentry/stores/configStore';

function trackReloadEvent(eventType: string, data: Record<PropertyKey, unknown>) {
  // quit early if analytics is disabled
  if (!ConfigStore.get('enableAnalytics')) {
    return;
  }
  window.ra?.event(eventType, data);
}

export default trackReloadEvent;
