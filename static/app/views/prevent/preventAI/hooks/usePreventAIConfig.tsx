import {useCallback, useEffect, useMemo, useState} from 'react';

import localStorageWrapper from 'sentry/utils/localStorage';
import type {PreventAIConfig} from 'sentry/views/prevent/preventAI/types';

type PreventAIConfigResult = {
  data: PreventAIConfig;
  isError: boolean;
  isLoading: boolean;
  refetch: () => void;
};

const DEFAULT_CONFIG: PreventAIConfig = {
  features: {
    vanilla: {enabled: false},
    test_generation: {enabled: false},
    bug_prediction: {
      enabled: false,
      triggers: {
        on_command_phrase: false,
        on_ready_for_review: false,
      },
    },
  },
};

function mergeConfig(
  stored: unknown,
  fallback: PreventAIConfig = DEFAULT_CONFIG
): PreventAIConfig {
  if (typeof stored !== 'object' || stored === null || !('features' in (stored as any))) {
    return fallback;
  }
  const parsed = stored as any;
  return {
    features: {
      vanilla: {
        ...fallback.features.vanilla,
        ...parsed.features?.vanilla,
      },
      test_generation: {
        ...fallback.features.test_generation,
        ...parsed.features?.test_generation,
      },
      bug_prediction: {
        ...fallback.features.bug_prediction,
        ...parsed.features?.bug_prediction,
        triggers: {
          ...fallback.features.bug_prediction.triggers,
          ...parsed.features?.bug_prediction?.triggers,
        },
      },
    },
  };
}

export function usePreventAIConfig(
  orgName?: string,
  repoName?: string
): PreventAIConfigResult {
  // Note: All below is dummy placeholder behavior until the api is hooked up

  const storageKey = useMemo(
    () => `prevent-ai-config-${orgName}-${repoName}`,
    [orgName, repoName]
  );

  const [config, setConfig] = useState<PreventAIConfig>(() => {
    try {
      const stored = localStorageWrapper.getItem(storageKey);
      if (stored) {
        return mergeConfig(JSON.parse(stored));
      }
    } catch {
      // ignore (we are using local storage for a dummy UI until the api is hooked up)
    }
    return DEFAULT_CONFIG;
  });

  const refetch = useCallback(() => {
    try {
      const latestStored = localStorageWrapper.getItem(storageKey);
      if (latestStored) {
        setConfig(mergeConfig(JSON.parse(latestStored)));
      } else {
        setConfig(DEFAULT_CONFIG);
      }
    } catch {
      setConfig(DEFAULT_CONFIG);
    }
  }, [storageKey]);

  // Re-fetch config when storage key changes (org/repo changes)
  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    data: config,
    isLoading: false,
    isError: false,
    refetch,
  };
}
