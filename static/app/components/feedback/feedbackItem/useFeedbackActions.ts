import {useCallback} from 'react';

import {bulkDelete} from 'sentry/actionCreators/group';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import useMutateFeedback from 'sentry/components/feedback/useMutateFeedback';
import {t} from 'sentry/locale';
import {GroupStatus} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  feedbackItem: FeedbackIssue;
}

const mutationOptions = {
  onError: () => {
    addErrorMessage(t('An error occurred while updating the feedback.'));
  },
  onSuccess: () => {
    addSuccessMessage(t('Updated feedback'));
  },
};

export default function useFeedbackActions({feedbackItem}: Props) {
  const organization = useOrganization();
  const projectId = feedbackItem.project?.id;
  const api = useApi();
  const navigate = useNavigate();
  const {pathname, query} = useLocation();
  const hasDelete =
    organization.access.includes('event:admin') &&
    organization.features.includes('issue-platform-deletion-ui');

  const {markAsRead, resolve} = useMutateFeedback({
    feedbackIds: [feedbackItem.id],
    organization,
    projectIds: feedbackItem.project ? [feedbackItem.project.id] : [],
  });

  const onDelete = useCallback(
    closeModal => {
      addLoadingMessage(t('Updating feedback...'));

      bulkDelete(
        api,
        {
          orgId: organization.slug,
          projectId: projectId,
          itemIds: [feedbackItem.id],
        },
        {
          complete: () => {
            closeModal();
            navigate(
              normalizeUrl({
                pathname: pathname,
                query: {
                  mailbox: query.mailbox,
                  project: query.project,
                  query: query.query,
                  statsPeriod: query.statsPeriod,
                },
              })
            );
          },
        }
      );
    },
    [
      api,
      feedbackItem.id,
      navigate,
      organization.slug,
      pathname,
      projectId,
      query.mailbox,
      query.project,
      query.query,
      query.statsPeriod,
    ]
  );

  // reuse the issues ignored category for spam feedbacks
  const isResolved = feedbackItem.status === GroupStatus.RESOLVED;
  const onResolveClick = useCallback(() => {
    addLoadingMessage(t('Updating feedback...'));
    const newStatus = isResolved ? GroupStatus.UNRESOLVED : GroupStatus.RESOLVED;
    resolve(newStatus, mutationOptions);
  }, [isResolved, resolve]);

  const isSpam = feedbackItem.status === GroupStatus.IGNORED;
  const onSpamClick = useCallback(() => {
    addLoadingMessage(t('Updating feedback...'));
    const newStatus = isSpam ? GroupStatus.UNRESOLVED : GroupStatus.IGNORED;
    resolve(newStatus, mutationOptions);
    if (!isSpam) {
      // not currently spam, clicking the button will turn it into spam
      trackAnalytics('feedback.mark-spam-clicked', {
        organization,
        type: 'details',
      });
    }
  }, [isSpam, organization, resolve]);

  const hasSeen = feedbackItem.hasSeen;
  const onMarkAsReadClick = useCallback(() => {
    addLoadingMessage(t('Updating feedback...'));
    markAsRead(!hasSeen, mutationOptions);
  }, [hasSeen, markAsRead]);

  return {
    hasDelete,
    onDelete,
    isResolved,
    onResolveClick,
    isSpam,
    onSpamClick,
    hasSeen,
    onMarkAsReadClick,
  };
}
