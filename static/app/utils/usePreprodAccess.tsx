import useOrganization from 'sentry/utils/useOrganization';

export function usePreprodAccess(): boolean {
  const organization = useOrganization({allowNull: true});
  if (!organization) {
    return false;
  }
  return (
    organization.isEarlyAdopter ||
    organization.features?.includes('preprod-frontend-routes')
  );
}
