import {ConfigStore} from 'sentry/stores/configStore';

export function trackMarketingEvent(
  event_type: string,
  options?: {event_label?: string; plan?: string}
) {
  // quit early if analytics is disabled
  if (!ConfigStore.get('enableAnalytics')) {
    return;
  }

  // Google
  globalThis.ga =
    globalThis.ga ||
    function (...args: any[]) {
      (globalThis.ga.q = globalThis.ga.q || []).push(args);
    };
  globalThis.ga.l = Date.now();
  globalThis.ga('send', {
    hitType: 'event',
    eventCategory: 'User',
    eventAction: event_type,
    eventLabel: options?.event_label,
  });

  // GA4
  globalThis.gtag?.('event', event_type, {
    event_category: 'User',
    event_label: options?.event_label,
  });
}
