import {useCallback, useState} from 'react';

// import {useMutation} from 'sentry/utils/queryClient';
// import useApi from 'sentry/utils/useApi';
// import useOrganization from 'sentry/utils/useOrganization';
// import type {Feature, Trigger} from 'sentry/views/prevent/preventAI/types';
import type {PreventAIConfig} from 'sentry/views/prevent/preventAI/types';

interface UpdateFeatureParams {
  enabled: boolean;
  feature: string;
  triggers: string[];
}

interface UpdateFeatureResult {
  enabled: boolean;
  feature: string;
  success: boolean;
  triggers: string[];
}

const STORAGE_KEY = 'prevent-ai-config';

function useUpdatePreventAIFeature() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TODO: Hook up to real API
  // const org = useOrganization();
  // const api = useApi();

  // const {mutateAsync: enableFeature} = useMutation({
  //   mutationFn: ({
  //     feature,
  //     triggers,
  //     enabled,
  //   }: {
  //     enabled: boolean;
  //     feature: Feature;
  //     triggers: Trigger[];
  //   }) => {
  //     return api.requestPromise(
  //       `/organizations/${org.slug}/prevent/ai/config/features/${feature}`,
  //       {
  //         method: 'PUT',
  //         data: {triggers, enabled},
  //       }
  //     );
  //   },
  // });

  const enableFeature = useCallback(
    async (params: UpdateFeatureParams): Promise<UpdateFeatureResult> => {
      setIsLoading(true);
      setError(null);

      try {
        // Load current config from localStorage
        const currentConfig: PreventAIConfig = (() => {
          try {
            const stored = localStorage.getItem(STORAGE_KEY);
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
              bug_prediction: {enabled: false, triggers: []},
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedConfig));

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
    []
  );

  return {
    enableFeature,
    isLoading,
    error,
  };
}

export default useUpdatePreventAIFeature;
