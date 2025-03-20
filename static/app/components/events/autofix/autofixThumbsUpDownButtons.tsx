import {addErrorMessage} from 'sentry/actionCreators/indicator';
import ButtonBar from 'sentry/components/buttonBar';
import {Button} from 'sentry/components/core/button';
import type {AutofixFeedback} from 'sentry/components/events/autofix/types';
import {
  type AutofixResponse,
  makeAutofixQueryKey,
} from 'sentry/components/events/autofix/useAutofix';
import {IconThumb} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';

export function useUpdateAutofixFeedback({
  groupId,
  runId,
}: {
  groupId: string;
  runId: string;
}) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      action:
        | 'root_cause_thumbs_up'
        | 'root_cause_thumbs_down'
        | 'solution_thumbs_up'
        | 'solution_thumbs_down';
    }) => {
      return api.requestPromise(`/issues/${groupId}/autofix/update/`, {
        method: 'POST',
        data: {
          run_id: runId,
          payload: {
            type: 'feedback',
            action: params.action,
          },
        },
      });
    },
    onMutate: params => {
      queryClient.setQueryData(makeAutofixQueryKey(groupId), (data: AutofixResponse) => {
        if (!data || !data.autofix) {
          return data;
        }

        return {
          ...data,
          autofix: {
            ...data.autofix,
            feedback: params.action.includes('solution')
              ? {
                  ...data.autofix.feedback,
                  solution_thumbs_up: params.action === 'solution_thumbs_up',
                  solution_thumbs_down: params.action === 'solution_thumbs_down',
                }
              : {
                  ...data.autofix.feedback,
                  root_cause_thumbs_up: params.action === 'root_cause_thumbs_up',
                  root_cause_thumbs_down: params.action === 'root_cause_thumbs_down',
                },
          },
        };
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: makeAutofixQueryKey(groupId),
      });
    },
    onError: () => {
      addErrorMessage(t('Something went wrong when updating the root cause feedback.'));
    },
  });
}

export default function AutofixThumbsUpDownButtons({
  feedback,
  groupId,
  runId,
  thumbsUpDownType,
}: {
  groupId: string;
  runId: string;
  thumbsUpDownType: 'root_cause' | 'solution';
  feedback?: AutofixFeedback;
}) {
  const {mutate: handleUpdateAutofixFeedback} = useUpdateAutofixFeedback({
    groupId,
    runId,
  });
  const openForm = useFeedbackForm();

  return (
    <ButtonBar>
      <Button
        size="sm"
        borderless
        onClick={() =>
          handleUpdateAutofixFeedback({action: `${thumbsUpDownType}_thumbs_up`})
        }
        title={
          thumbsUpDownType === 'root_cause'
            ? t('This root cause is helpful')
            : t('This solution is helpful')
        }
      >
        {
          <IconThumb
            color={
              thumbsUpDownType === 'root_cause'
                ? feedback?.root_cause_thumbs_up
                  ? 'green400'
                  : 'gray300'
                : feedback?.solution_thumbs_up
                  ? 'green400'
                  : 'gray300'
            }
            size="sm"
            direction="up"
          />
        }
      </Button>
      <Button
        size="sm"
        borderless
        onClick={() => {
          handleUpdateAutofixFeedback({action: `${thumbsUpDownType}_thumbs_down`});
          openForm?.({
            messagePlaceholder: t('How can we make Autofix better for you?'),
            tags: {
              ['feedback.source']: `issue_details_ai_autofix_${thumbsUpDownType}`,
              ['feedback.owner']: 'ml-ai',
            },
          });
        }}
        title={
          thumbsUpDownType === 'root_cause'
            ? t('This root cause is incorrect or not helpful')
            : t('This solution is incorrect or not helpful')
        }
      >
        {
          <IconThumb
            color={
              thumbsUpDownType === 'root_cause'
                ? feedback?.root_cause_thumbs_down
                  ? 'red400'
                  : 'gray300'
                : feedback?.solution_thumbs_down
                  ? 'red400'
                  : 'gray300'
            }
            size="sm"
            direction="down"
          />
        }
      </Button>
    </ButtonBar>
  );
}
