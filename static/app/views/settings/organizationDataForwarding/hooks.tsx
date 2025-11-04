import useOrganization from 'sentry/utils/useOrganization';

export function useHasDataForwardingAccess() {
  const organization = useOrganization();
  const featureSet = new Set(organization.features);

  return (
    // Can access the new UI/UX and endpoints
    featureSet.has('data-forwarding-revamp-access') &&
    // Can access the feature itself (subscription-based)
    featureSet.has('data-forwarding')
  );
}
