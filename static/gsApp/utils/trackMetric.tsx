import ConfigStore from 'sentry/stores/configStore';

function trackMetric(
  _name: string,
  _value: number,
  _tags: Record<PropertyKey, unknown> | undefined = {}
): void {
  // quit early if analytics is disabled
  if (!ConfigStore.get('enableAnalytics')) {
    return;
  }

  // XXX(epurkhiser): We removed reload metrics since we no longer use this,
  // however we've kept this function around in case we want to replace
  // frontend metric recording with something else.
}

export default trackMetric;
