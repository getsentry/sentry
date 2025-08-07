import {useCallback} from 'react';
import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

interface DeleteButtonProps {
  projectSlug: string | null;
  replayId: string | undefined;
}

export default function useDeleteReplay({projectSlug, replayId}: DeleteButtonProps) {
  const api = useApi();
  const navigate = useNavigate();
  const organization = useOrganization();

  const {referrer, groupId} = useLocationQuery({
    fields: {
      referrer: decodeScalar,
      groupId: decodeScalar,
    },
  });

  const issueReferrer = Boolean(referrer?.includes('issues') && groupId);

  const handleDelete = useCallback(async () => {
    if (!projectSlug || !replayId) {
      return;
    }

    try {
      await api.requestPromise(
        `/projects/${organization.slug}/${projectSlug}/replays/${replayId}/`,
        {
          method: 'DELETE',
        }
      );
      navigate(
        issueReferrer
          ? {pathname: `/organizations/${organization.slug}/issues/${groupId}/replays/`}
          : makeReplaysPathname({
              path: '/',
              organization,
            }),
        {replace: true}
      );
    } catch (err) {
      addErrorMessage(t('Failed to delete replay'));
      Sentry.captureException(err);
    }
  }, [api, navigate, organization, projectSlug, replayId, issueReferrer, groupId]);

  const confirmDelete = useCallback(() => {
    if (!projectSlug || !replayId) {
      return;
    }

    openConfirmModal({
      message: t('Are you sure you want to delete this replay?'),
      onConfirm: handleDelete,
    });
  }, [handleDelete, projectSlug, replayId]);

  return confirmDelete;
}
