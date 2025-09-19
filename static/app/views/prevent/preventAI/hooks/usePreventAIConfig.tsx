import {useCallback, useState} from 'react';

import type {PreventAIConfig} from 'sentry/views/prevent/preventAI/types';

interface PreventAIConfigResult {
  data: PreventAIConfig | undefined;
  isError: boolean;
  isLoading: boolean;
  refetch: () => void;
}

export function usePreventAIConfig(
  orgName?: string,
  repoName?: string
): PreventAIConfigResult {
  // TODO: Hook up to real API - GET `/organizations/${organization.slug}/prevent/ai/config/`

  // TODO: Below reads/writes from localstorage until real apis hooked up
  // Generate storage key based on org and repo
  const getStorageKey = useCallback(() => {
    if (!orgName || !repoName) {
      return 'prevent-ai-config-default';
    }
    return `prevent-ai-config-${orgName}-${repoName}`;
  }, [orgName, repoName]);
  const loadConfig = useCallback((): PreventAIConfig => {
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
          triggers: {
            on_command_phrase: false,
            on_ready_for_review: false,
            on_new_commit: false,
          },
        },
      },
    };

    try {
      const storageKey = getStorageKey();
      const stored = localStorage.getItem(storageKey);
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
  }, [getStorageKey]);

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
