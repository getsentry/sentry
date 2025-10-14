import {createContext, useContext, useEffect, useState} from 'react';

import type {Detector} from 'sentry/types/workflowEngine/detectors';
import type {UseApiQueryOptions} from 'sentry/utils/queryClient';

type DetectorQueryOptions = Partial<UseApiQueryOptions<any>>;

interface DetectorQueryOptionsContextValue {
  options: DetectorQueryOptions;
  setOptions: (options: DetectorQueryOptions) => void;
}

const DetectorQueryOptionsContext = createContext<
  DetectorQueryOptionsContextValue | undefined
>(undefined);

interface DetectorQueryOptionsProviderProps {
  children: React.ReactNode;
}

export function DetectorQueryOptionsProvider({
  children,
}: DetectorQueryOptionsProviderProps) {
  const [options, setOptions] = useState<DetectorQueryOptions>({});

  return (
    <DetectorQueryOptionsContext.Provider value={{options, setOptions}}>
      {children}
    </DetectorQueryOptionsContext.Provider>
  );
}

/**
 * Hook to configure detector query options dynamically from child components.
 * This is useful when a detector type (e.g., cron) needs to set specific query
 * options like refetchInterval that depend on the detector data, but the detector
 * type is not known until after the initial query completes.
 *
 * @param options - The query options to configure (e.g., refetchInterval)
 */
export function useConfigureDetectorOptions<T extends Detector>(
  options: Partial<UseApiQueryOptions<T>>
) {
  const context = useContext(DetectorQueryOptionsContext);

  if (!context) {
    throw new Error(
      'useConfigureDetectorOptions must be used within DetectorQueryOptionsProvider'
    );
  }

  const {setOptions} = context;

  useEffect(() => {
    setOptions(options);
    // Reset options on unmount
    return () => setOptions({});
  }, [options, setOptions]);
}

/**
 * Hook to access the configured detector query options.
 */
export function useDetectorQueryOptions(): DetectorQueryOptions {
  const context = useContext(DetectorQueryOptionsContext);

  if (!context) {
    throw new Error(
      'useDetectorQueryOptions must be used within DetectorQueryOptionsProvider'
    );
  }

  return context.options;
}
