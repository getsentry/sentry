import {useCallback, useMemo} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {useInfiniteFeedbackListData} from 'sentry/components/feedback/feedbackDataContext';
import {t} from 'sentry/locale';
import type {HydratedFeedbackItem} from 'sentry/utils/feedback/item/types';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  feedbackItem: HydratedFeedbackItem;
}

export default function useResolveFeedback({feedbackItem}: Props) {
  const feedbackId = feedbackItem.feedback_id;

  const api = useApi();
  const organization = useOrganization();
  const {setFeedback} = useInfiniteFeedbackListData();

  const url = useMemo(() => {
    return `/organizations/${organization.slug}/issues/${feedbackId}/`;
  }, [feedbackId, organization]);

  const handleResolve = useCallback(async () => {
    addLoadingMessage(t('Updating feedback...'));
    try {
      await api.requestPromise(url, {
        method: 'PUT',
        data: {status: feedbackItem.status === 'unresolved' ? 'resolved' : 'unresolved'},
      });
      addSuccessMessage(t('Updated feedback'));
      setFeedback(feedbackId, undefined);
    } catch {
      addErrorMessage(t('An error occurred while resolving the feedback.'));
    }
  }, [api, feedbackId, setFeedback, url, feedbackItem.status]);

  return {
    onResolve: () => handleResolve(),
  };
}
