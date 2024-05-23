import useOrganization from 'sentry/utils/useOrganization';

export type WebVitalsAggregateFunction = 'avg' | 'p75';

export function useAggregateFunction(): WebVitalsAggregateFunction {
  const organization = useOrganization();
  if (organization.features.includes('performance-webvitals-avg')) {
    return 'avg';
  }
  return 'p75';
}
