import useConfiguration from 'sentry/components/devtoolbar/hooks/useConfiguration';

export default function useEnabledFeatureFlags() {
  const {organization} = useConfiguration();
  return organization?.features;
}
