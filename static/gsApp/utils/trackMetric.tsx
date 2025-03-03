import ConfigStore from 'sentry/stores/configStore';

function trackMetric(
  name: string,
  value: number,
  tags: Record<PropertyKey, unknown> | undefined = {}
): void {
  // quit early if analytics is disabled
  if (!ConfigStore.get('enableAnalytics')) {
    return;
  }

  const release = window.__initialData.sentryConfig?.release;

  window.ra?.metric(name, value, {...tags, release});
}

export default trackMetric;
