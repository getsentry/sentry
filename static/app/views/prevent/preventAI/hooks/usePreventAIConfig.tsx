import {useMemo} from 'react';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
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
        on_new_commit: false,
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
  const storageKey = useMemo(
    () => `prevent-ai-config-${orgName}-${repoName}`,
    [orgName, repoName]
  );

  const [stored] = useLocalStorageState(storageKey, undefined);

  const config = useMemo(() => {
    try {
      if (stored) {
        return mergeConfig(JSON.parse(stored));
      }
    } catch {
      // ignore (we are using local storage for a dummy UI until the api is hooked up)
    }
    return DEFAULT_CONFIG;
  }, [stored]);

  return {
    data: config,
    isLoading: false,
    isError: false,
    refetch: () => {},
  };
}
