// TODO: Hook up to real API
// import {useApiQuery} from 'sentry/utils/queryClient';
// import useOrganization from 'sentry/utils/useOrganization';
import type {PreventAIConfig} from 'sentry/views/prevent/preventAI/types';

export interface PreventAIConfigResult {
  data: PreventAIConfig | undefined;
  isError: boolean;
  isLoading: boolean;
  refetch: () => void;
}

export function usePreventAIConfig(): PreventAIConfigResult {
  // TODO: Hook up to real API
  // const organization = useOrganization();
  // const {data, isLoading, isError, refetch} = useApiQuery<PreventAIConfig>(
  //   [`/organizations/${organization.slug}/prevent/ai/config/`],
  //   {staleTime: Infinity}
  // );

  return {
    data: {
      features: {
        vanilla_pr_review: {
          enabled: true,
        },
        test_generation: {
          enabled: true,
        },
        bug_prediction: {
          enabled: true,
          triggers: ['on_ready_for_review', 'on_new_commit'],
        },
      },
    },
    isLoading: false,
    isError: false,
    refetch: () => {},
  };
}

export default usePreventAIConfig;
