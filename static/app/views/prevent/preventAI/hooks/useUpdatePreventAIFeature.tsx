// import {useMutation} from 'sentry/utils/queryClient';
// import useApi from 'sentry/utils/useApi';
// import useOrganization from 'sentry/utils/useOrganization';
// import type {Feature, Trigger} from 'sentry/views/prevent/preventAI/types';

function useUpdatePreventAIFeature() {
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

  // return {enableFeature};

  return {
    enableFeature: async ({
      feature,
      enabled,
      triggers,
    }: {
      enabled: boolean;
      feature: string;
      triggers: string[];
    }) => {
      // eslint-disable-next-line no-console
      console.log('[Mock] enableFeature called', {feature, enabled, triggers});
      return Promise.resolve({success: true, feature, enabled, triggers});
    },
  };
}

export default useUpdatePreventAIFeature;
