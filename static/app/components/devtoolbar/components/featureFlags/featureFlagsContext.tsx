import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useState} from 'react';

import useConfiguration from 'sentry/components/devtoolbar/hooks/useConfiguration';
import type {FeatureFlagMap, FlagValue} from 'sentry/components/devtoolbar/types';

interface Context {
  /**
   * Call through to the user-supplied clearOverrides() function to reset override state.
   */
  clearOverrides: () => void;

  /**
   * The map of effective feature flags.
   */
  featureFlagMap: FeatureFlagMap;

  /**
   * Whether the state of overridden flags has changed in this session. After
   * state is changed you must reload the page to ensure that you're getting a
   * consistent experience.
   */
  isDirty: boolean;

  /**
   * Set an override. Marks the state as dirty.
   *
   * Setting an override back to default will not un-mark the dirty flag.
   */
  setOverride: (name: string, value: FlagValue) => void;
}

const FeatureFlagContext = createContext<Context>({
  clearOverrides: () => {},
  featureFlagMap: {},
  isDirty: false,
  setOverride: () => {},
});

export function FeatureFlagsContextProvider({children}: {children: ReactNode}) {
  const {featureFlags} = useConfiguration();

  const [isDirty, setIsDirty] = useState(false);
  const [featureFlagMap, setFeatureFlagMap] = useState(
    () => featureFlags?.getFeatureFlagMap?.() ?? {}
  );

  const setOverride = useCallback(
    (name: string, value: FlagValue) => {
      featureFlags?.setOverrideValue?.(name, value);
      setIsDirty(true);
      setFeatureFlagMap(featureFlags?.getFeatureFlagMap?.() ?? {});
    },
    [featureFlags]
  );

  const clearOverrides = useCallback(() => {
    featureFlags?.clearOverrides?.();
    setIsDirty(true);
    setFeatureFlagMap(featureFlags?.getFeatureFlagMap?.() ?? {});
  }, [featureFlags]);

  return (
    <FeatureFlagContext.Provider
      value={{isDirty, featureFlagMap, setOverride, clearOverrides}}
    >
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlagsContext() {
  return useContext(FeatureFlagContext);
}
