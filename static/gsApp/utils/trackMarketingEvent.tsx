import ConfigStore from 'sentry/stores/configStore';

function trackMarketingEvent(
  event_type: string,
  options?: {event_label?: string; plan?: string}
) {
  // quit early if analytics is disabled
  if (!ConfigStore.get('enableAnalytics')) {
    return;
  }

  // Google
  window.ga =
    window.ga ||
    function (...args: any[]) {
      (window.ga.q = window.ga.q || []).push(args);
    };
  window.ga.l = +new Date();
  window.ga('send', {
    hitType: 'event',
    eventCategory: 'User',
    eventAction: event_type,
    eventLabel: options?.event_label,
  });

  // GA4
  window.gtag?.('event', event_type, {
    event_category: 'User',
    event_label: options?.event_label,
  });
}

export default trackMarketingEvent;
