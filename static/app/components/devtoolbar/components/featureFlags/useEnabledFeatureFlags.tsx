import {useToolbarOrganization} from 'sentry/components/devtoolbar/hooks/useConfiguration';

export default function useEnabledFeatureFlags() {
  const organization = useToolbarOrganization();
  return organization?.features;
}
