import useConfiguration from 'sentry/components/devtoolbar/hooks/useConfiguration';

export default function useEnabledFeatureFlags() {
  const {featureFlags} = useConfiguration();
  return featureFlags;
}
