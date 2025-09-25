import {useCallback, useState} from 'react';

import localStorageWrapper from 'sentry/utils/localStorage';
import type {PreventAIConfig} from 'sentry/views/prevent/preventAI/types';

interface UpdateFeatureParams {
  enabled: boolean;
  feature: 'vanilla' | 'test_generation' | 'bug_prediction';
  triggers?: Record<string, boolean>;
}

interface UpdateFeatureResult {
  enabled: boolean;
  feature: string;
  success: boolean;
  triggers?: Record<string, boolean>;
}

export function useUpdatePreventAIFeature(orgName?: string, repoName?: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TODO: Hook up to real API - PUT `/organizations/${organization.slug}/prevent/ai/config/features/${feature}`

  const enableFeature = useCallback(
    async (params: UpdateFeatureParams): Promise<UpdateFeatureResult> => {
      setIsLoading(true);
      setError(null);

      // TODO: Below reads/writes from localstorage until real apis hooked up
      try {
        // Generate storage key based on org and repo
        const getStorageKey = () => {
          if (!orgName || !repoName) {
            return 'prevent-ai-config-default';
          }
          return `prevent-ai-config-${orgName}-${repoName}`;
        };

        // Load current config from localStorage
        const currentConfig: PreventAIConfig = (() => {
          try {
            const storageKey = getStorageKey();
            const stored = localStorageWrapper.getItem(storageKey);
            if (stored) {
              return JSON.parse(stored);
            }
          } catch (err) {
            // Silently handle localStorage errors
          }
          // Return default config if nothing stored
          return {
            features: {
              vanilla_pr_review: {enabled: false},
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
        })();

        // Update the specific feature
        const updatedConfig: PreventAIConfig = {
          ...currentConfig,
          features: {
            ...currentConfig.features,
            [params.feature]: {
              enabled: params.enabled,
              triggers: params.triggers,
            },
          },
        };

        // Save to localStorage
        const storageKey = getStorageKey();
        localStorageWrapper.setItem(storageKey, JSON.stringify(updatedConfig));

        // Simulate API delay for realistic UX
        await new Promise(resolve => setTimeout(resolve, 300));

        const result = {
          success: true,
          feature: params.feature,
          enabled: params.enabled,
          triggers: params.triggers,
        };

        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to update feature';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [orgName, repoName]
  );

  return {
    enableFeature,
    isLoading,
    error,
  };
}
