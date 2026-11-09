import {useCallback} from 'react';
import * as Sentry from '@sentry/react';
import {useMutation} from '@tanstack/react-query';
import {parseAsString, useQueryState} from 'nuqs';

import {openConfirmModal} from '@sentry/scraps/confirm';
import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeReplaysPathname} from 'sentry/views/explore/replays/pathnames';

interface DeleteButtonProps {
  projectSlug: string | null;
  replayId: string | undefined;
}

export function useDeleteReplay({projectSlug, replayId}: DeleteButtonProps) {
  const navigate = useNavigate();
  const organization = useOrganization();

  const [referrer] = useQueryState('referrer', parseAsString.withDefault(''));
  const [groupId] = useQueryState('groupId', parseAsString.withDefault(''));

  const issueReferrer = Boolean(referrer?.includes('issues') && groupId);

  const {mutateAsync: deleteReplay} = useMutation({
    mutationFn: (path: {projectIdOrSlug: string; replayId: string}) =>
      fetchMutation({
        url: getApiUrl(
          '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/$replayId/',
          {
            path: {organizationIdOrSlug: organization.slug, ...path},
          }
        ),
        method: 'DELETE',
      }),
  });

  const handleDelete = useCallback(async () => {
    if (!projectSlug || !replayId) {
      return;
    }

    try {
      await deleteReplay({projectIdOrSlug: projectSlug, replayId});
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
      toast.error(t('Failed to delete replay'));
      Sentry.captureException(err);
    }
  }, [
    deleteReplay,
    navigate,
    organization,
    projectSlug,
    replayId,
    issueReferrer,
    groupId,
  ]);

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
