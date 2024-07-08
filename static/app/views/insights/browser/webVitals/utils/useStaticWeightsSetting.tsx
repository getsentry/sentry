import useOrganization from 'sentry/utils/useOrganization';

export function useStaticWeightsSetting(): boolean {
  const organization = useOrganization();
  return organization.features.includes('insights-browser-webvitals-static-weights');
}
