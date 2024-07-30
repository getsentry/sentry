import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useState} from 'react';

import useConfiguration from 'sentry/components/devtoolbar/hooks/useConfiguration';
import type {FeatureFlagMap} from 'sentry/components/devtoolbar/types';

const FeatureFlagContext = createContext<{
  clearOverrides: () => void;
  featureFlagMap: FeatureFlagMap;
  hasOverride: () => void;
  isDirty: boolean;
}>({
  clearOverrides: () => {},
  featureFlagMap: {},
  hasOverride: () => {},
  isDirty: false,
});

export function FeatureFlagsContextProvider({children}: {children: ReactNode}) {
  const {featureFlags} = useConfiguration();

  const [isDirty, setIsDirty] = useState(false);
  const [featureFlagMap, setFeatureFlagMap] = useState(
    () => featureFlags?.getFeatureFlagMap?.() ?? {}
  );

  const hasOverride = useCallback(() => {
    setIsDirty(true);
    setFeatureFlagMap(() => featureFlags?.getFeatureFlagMap?.() ?? {});
  }, [featureFlags]);

  const clearOverrides = useCallback(() => {
    featureFlags?.clear?.();
    setIsDirty(true);
    setFeatureFlagMap(() => featureFlags?.getFeatureFlagMap?.() ?? {});
  }, [featureFlags]);

  return (
    <FeatureFlagContext.Provider
      value={{isDirty, featureFlagMap, hasOverride, clearOverrides}}
    >
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlagsContext() {
  return useContext(FeatureFlagContext);
}
