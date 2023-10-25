import {useCallback, useMemo} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {GroupStatus} from 'sentry/types';
import type {HydratedFeedbackItem} from 'sentry/utils/feedback/item/types';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  feedbackItem: HydratedFeedbackItem;
}

export default function useUpdateFeedback({feedbackItem}: Props) {
  const feedbackId = feedbackItem.feedback_id;

  const api = useApi();
  const organization = useOrganization();

  const url = useMemo(() => {
    return `/organizations/${organization.slug}/issues/${feedbackId}/`;
  }, [feedbackId, organization]);

  const handleUpdate = useCallback(
    async (newStatus: GroupStatus) => {
      addLoadingMessage(t('Updating feedback...'));
      try {
        await api.requestPromise(url, {
          method: 'PUT',
          data: {
            status: newStatus,
          },
        });
        addSuccessMessage(t('Updated feedback'));
      } catch {
        addErrorMessage(t('An error occurred while updating the feedback.'));
      }
    },
    [api, url]
  );

  return {
    onSetStatus: handleUpdate,
  };
}
