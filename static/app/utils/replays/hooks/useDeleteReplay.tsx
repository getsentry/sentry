import {useCallback} from 'react';
import * as Sentry from '@sentry/react';
import {parseAsString, useQueryState} from 'nuqs';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeReplaysPathname} from 'sentry/views/explore/replays/pathnames';

interface DeleteButtonProps {
  projectSlug: string | null;
  replayId: string | undefined;
}

export function useDeleteReplay({projectSlug, replayId}: DeleteButtonProps) {
  const api = useApi();
  const navigate = useNavigate();
  const organization = useOrganization();

  const [referrer] = useQueryState('referrer', parseAsString.withDefault(''));
  const [groupId] = useQueryState('groupId', parseAsString.withDefault(''));

  const issueReferrer = Boolean(referrer?.includes('issues') && groupId);

  const handleDelete = useCallback(async () => {
    if (!projectSlug || !replayId) {
      return;
    }

    try {
      await api.requestPromise(
        getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/$replayId/', {
          path: {
            organizationIdOrSlug: organization.slug,
            projectIdOrSlug: projectSlug,
            replayId,
          },
        }),
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
