import {useFeatureFlagsContext} from 'sentry/components/devtoolbar/components/featureFlags/featureFlagsContext';

export default function useHasCustomFlagOverrides(): boolean {
  const {featureFlagMap} = useFeatureFlagsContext();
  return (
    Object.entries(featureFlagMap)?.filter(
      ([_name, {value, override}]) => override !== undefined && value !== override
    ).length > 0
  );
}
