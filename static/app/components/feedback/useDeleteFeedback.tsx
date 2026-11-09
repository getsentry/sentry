import {useCallback} from 'react';

import {openConfirmModal} from '@sentry/scraps/confirm';
import {toast} from '@sentry/scraps/toast';

import {bulkDelete} from 'sentry/actionCreators/group';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeFeedbackPathname} from 'sentry/views/feedback/pathnames';

import {useRefetchFeedbackList} from './list/useRefetchFeedbackList';

export const useDeleteFeedback = (feedbackIds: any, projectId: any) => {
  const organization = useOrganization();
  const api = useApi({
    persistInFlight: false,
  });
  const navigate = useNavigate();
  const {query: locationQuery} = useLocation();

  const {refetchFeedbackList} = useRefetchFeedbackList();

  return useCallback(() => {
    openConfirmModal({
      onConfirm: async () => {
        toast.loading(t('Updating feedback...'));
        try {
          await bulkDelete(api, {
            orgId: organization.slug,
            projectId,
            itemIds: feedbackIds,
          });
          navigate(
            normalizeUrl({
              pathname: makeFeedbackPathname({
                path: '/',
                organization,
              }),
              query: {
                mailbox: locationQuery.mailbox,
                project: locationQuery.project,
                query: locationQuery.query,
                statsPeriod: locationQuery.statsPeriod,
              },
            })
          );
        } catch {
          // GroupStore already shows the error
        }
        refetchFeedbackList();
      },
      message: t('Deleting feedback is permanent. Are you sure you wish to continue?'),
      confirmText: t('Delete'),
    });
  }, [
    api,
    feedbackIds,
    locationQuery.mailbox,
    locationQuery.project,
    locationQuery.query,
    locationQuery.statsPeriod,
    navigate,
    organization,
    projectId,
    refetchFeedbackList,
  ]);
};
