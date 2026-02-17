import useOrganization from 'sentry/utils/useOrganization';

/**
 * Determines whether we should render the EAP UI mode, only rendering widgets that read from and support EAP.
 */
export const useEAPUI = (): boolean => {
  const organization = useOrganization();

  return organization.features.includes('performance-otel-friendly-ui');
};
