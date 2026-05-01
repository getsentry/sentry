import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconCheckmark} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import type {ListCheckboxQueryKeyRef} from 'sentry/utils/list/useListItemCheckboxState';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  HydratedReplayRecord,
  ReplayListRecord,
} from 'sentry/views/explore/replays/types';

interface Props {
  deselectAll: () => void;
  queryKeyRef: ListCheckboxQueryKeyRef;
  replays: ReplayListRecord[];
  selectedIds: string[];
}

export function ReplayBulkViewedActions({
  deselectAll,
  replays,
  selectedIds,
  queryKeyRef,
}: Props) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const selectedRows = replays.filter(
    replay => selectedIds.includes(replay.id) && !replay.is_archived && !replay.has_viewed
  );

  const runMarkViewed = async () => {
    setIsLoading(true);

    const results = await Promise.allSettled(
      selectedRows.map(replay => {
        const url = `/projects/${organization.slug}/${replay.project_id}/replays/${replay.id}/viewed-by/`;

        return fetchMutation({method: 'POST', url}).then(() => replay.id);
      })
    );

    const failed = results.filter(promise => promise.status === 'rejected');
    const succeededIds = new Set(
      results.filter(result => result.status === 'fulfilled').map(result => result.value)
    );

    if (succeededIds.size) {
      if (queryKeyRef.current) {
        // eslint-disable-next-line @sentry/no-query-data-type-parameters
        queryClient.setQueryData<ApiResponse<{data: HydratedReplayRecord[]}>>(
          queryKeyRef.current,
          old =>
            old && {
              ...old,
              json: {
                ...old.json,
                data: old.json.data.map(item =>
                  succeededIds.has(item.id) ? {...item, has_viewed: true} : item
                ),
              },
            }
        );
      }

      deselectAll();
    }

    const projectIds = new Set(
      selectedRows
        .map(replay => replay.project_id && String(replay.project_id))
        .filter(Boolean) as string[]
    );

    trackAnalytics('replay.bulk_mark_viewed', {
      organization,
      failed: failed.length,
      succeeded: succeededIds.size,
      multiProject: projectIds.size > 1,
    });

    if (failed.length === 0) {
      addSuccessMessage(
        tn(
          'Marked 1 replay as viewed.',
          'Marked %s replays as viewed.',
          succeededIds.size
        )
      );
    } else if (succeededIds.size) {
      addErrorMessage(
        t(
          'Updated %s of %s — some replays could not be updated. Try again or refresh the list.',
          succeededIds.size,
          selectedRows.length
        )
      );
    } else {
      addErrorMessage(t('Replays could not be updated. Try again or refresh the list.'));
    }

    setIsLoading(false);
  };

  return (
    <Button
      icon={
        isLoading ? (
          <LoadingIndicator size={12} style={{display: 'block', margin: 0}} />
        ) : (
          <IconCheckmark />
        )
      }
      size="xs"
      disabled={isLoading}
      onClick={runMarkViewed}
    >
      {t('Mark as viewed')}
    </Button>
  );
}
