import useOrganization from 'sentry/utils/useOrganization';

/**
 * Determines whether we should make UI tweaks to make it more OTel-friendly. This usually affects things like default columns in Explore, using the `span.name` attribute instead of `span.op`, and so on.
 */
export const useOTelFriendlyUI = (): boolean => {
  const organization = useOrganization();

  return organization.features.includes('performance-otel-friendly-ui');
};
