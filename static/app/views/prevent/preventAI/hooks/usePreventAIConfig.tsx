// TODO: Hook up to real API
// import {useApiQuery} from 'sentry/utils/queryClient';
// import useOrganization from 'sentry/utils/useOrganization';
import {useCallback, useState} from 'react';

import type {PreventAIConfig} from 'sentry/views/prevent/preventAI/types';

export interface PreventAIConfigResult {
  data: PreventAIConfig | undefined;
  isError: boolean;
  isLoading: boolean;
  refetch: () => void;
}

const STORAGE_KEY = 'prevent-ai-config';

export function usePreventAIConfig(): PreventAIConfigResult {
  // TODO: Hook up to real API
  // const organization = useOrganization();
  // const {data, isLoading, isError, refetch} = useApiQuery<PreventAIConfig>(
  //   [`/organizations/${organization.slug}/prevent/ai/config/`],
  //   {staleTime: Infinity}
  // );

  // Load from localStorage
  const loadConfig = useCallback((): PreventAIConfig => {
    // Default config
    const defaultConfig: PreventAIConfig = {
      features: {
        vanilla_pr_review: {
          enabled: false,
        },
        test_generation: {
          enabled: false,
        },
        bug_prediction: {
          enabled: false,
          triggers: [],
        },
      },
    };

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure all fields exist
        return {
          features: {
            ...defaultConfig.features,
            ...parsed.features,
          },
        };
      }
    } catch (err) {
      // Silently handle localStorage errors
    }
    return defaultConfig;
  }, []);

  const [config, setConfig] = useState<PreventAIConfig>(loadConfig);

  const refetch = useCallback(() => {
    const newConfig = loadConfig();
    setConfig(newConfig);
  }, [loadConfig]);

  return {
    data: config,
    isLoading: false,
    isError: false,
    refetch,
  };
}

export default usePreventAIConfig;
