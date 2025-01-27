import {useCallback} from 'react';

import {bulkDelete} from 'sentry/actionCreators/group';
import {addLoadingMessage} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import {t} from 'sentry/locale';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

export const useDeleteFeedback = (feedbackIds: any, projectId: any) => {
  const organization = useOrganization();
  const api = useApi({
    persistInFlight: false,
  });
  const navigate = useNavigate();
  const {query: locationQuery} = useLocation();

  return useCallback(() => {
    openConfirmModal({
      onConfirm: () => {
        addLoadingMessage(t('Updating feedback...'));
        bulkDelete(
          api,
          {
            orgId: organization.slug,
            projectId,
            itemIds: feedbackIds,
          },
          {
            complete: () => {
              navigate(
                normalizeUrl({
                  pathname: `/organizations/${organization.slug}/feedback/`,
                  query: {
                    mailbox: locationQuery.mailbox,
                    project: locationQuery.project,
                    query: locationQuery.query,
                    statsPeriod: locationQuery.statsPeriod,
                  },
                })
              );
            },
          }
        );
      },
      message: t('Deleting feedbacks is permanent. Are you sure you wish to continue?'),
      confirmText: t('Delete'),
    });
  }, [api, feedbackIds, locationQuery, navigate, organization.slug, projectId]);
};
