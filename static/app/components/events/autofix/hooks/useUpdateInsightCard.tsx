import {addErrorMessage, addLoadingMessage} from 'sentry/actionCreators/indicator';
import {makeAutofixQueryKey} from 'sentry/components/events/autofix/useAutofix';
import {t} from 'sentry/locale';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface UpdateInsightParams {
  message: string;
  retain_insight_card_index: number | null;
  step_index: number;
}

/**
 * Hook for updating insight cards with feedback and triggering a rethink.
 */
export function useUpdateInsightCard({groupId, runId}: {groupId: string; runId: string}) {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();
  const orgSlug = useOrganization().slug;

  return useMutation({
    mutationFn: (params: UpdateInsightParams) => {
      return api.requestPromise(
        `/organizations/${orgSlug}/issues/${groupId}/autofix/update/`,
        {
          method: 'POST',
          data: {
            run_id: runId,
            payload: {
              type: 'restart_from_point_with_feedback',
              message: params.message.trim(),
              step_index: params.step_index,
              retain_insight_card_index: params.retain_insight_card_index,
            },
          },
        }
      );
    },
    onSuccess: _ => {
      queryClient.invalidateQueries({
        queryKey: makeAutofixQueryKey(orgSlug, groupId, true),
      });
      queryClient.invalidateQueries({
        queryKey: makeAutofixQueryKey(orgSlug, groupId, false),
      });
      addLoadingMessage(t('Rethinking this...'));
    },
    onError: () => {
      addErrorMessage(t('Something went wrong when sending Seer your message.'));
    },
  });
}
