import {createContext, useContext} from 'react';

import type {MetricMeta, MRI} from 'sentry/types/metrics';

const Context = createContext<{
  getVirtualMRI: (mri: MRI) => MRI | null;
  getVirtualMeta: (mri: MRI) => MetricMeta;
  isLoading: boolean;
}>({
  getVirtualMRI: () => null,
  getVirtualMeta: () => {
    throw new Error('Not implemented');
  },
  isLoading: false,
});

export function useVirtualMetricsContext() {
  return useContext(Context);
}

// TODO(aknaus): Write a provider
