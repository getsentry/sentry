import {useOrganization} from 'sentry/utils/useOrganization';

export function useSettingsV3(): boolean {
  const organization = useOrganization({allowNull: true});
  return organization?.features.includes('settings-v3') ?? false;
}
