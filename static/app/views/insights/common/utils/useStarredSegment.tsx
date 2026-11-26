import {useIsMutating, useMutation, useQueryClient} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {defined} from 'sentry/utils/defined';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SpanResponse} from 'sentry/views/insights/types';

export const STARRED_SEGMENT_TABLE_QUERY_KEY = 'starred-segment-table';

type TableRow = Pick<SpanResponse, 'transaction'> &
  Partial<Pick<SpanResponse, 'is_starred_transaction' | 'project' | 'project.id'>>;
type TableData = {data: TableRow[]};

interface Props {
  segmentName: string;
  selectedProjectId?: string | undefined;
  selectedProjectSlug?: string | undefined;
}

export function useStarredSegment({
  selectedProjectId,
  selectedProjectSlug,
  segmentName,
}: Props) {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const starredSegmentMutationKey = [
    'star-segment',
    organization.slug,
    selectedProjectId,
    segmentName,
  ];
  const isMutating = useIsMutating({mutationKey: starredSegmentMutationKey});

  const url = getApiUrl('/organizations/$organizationIdOrSlug/starred-service-spans/', {
    path: {organizationIdOrSlug: organization.slug},
  });
  const payload = {project_id: selectedProjectId, service_span: segmentName};

  const updateTableData = (newIsStarred: boolean) => {
    queryClient.setQueriesData(
      {
        ...apiOptions.queryFilter('/organizations/$organizationIdOrSlug/events/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        predicate: ({queryKey}) => queryKey.at(-1) === STARRED_SEGMENT_TABLE_QUERY_KEY,
      },
      (oldResponse: ApiResponse<TableData> | undefined) => {
        if (!oldResponse) {
          return;
        }
        const previousRows = oldResponse.json.data;
        const data = previousRows.map(row => {
          const rowProjectId = row['project.id'];
          const matchesProject = defined(rowProjectId)
            ? String(rowProjectId) === selectedProjectId
            : selectedProjectSlug !== undefined && row.project === selectedProjectSlug;
          return row.transaction === segmentName &&
            matchesProject &&
            defined(row.is_starred_transaction) &&
            row.is_starred_transaction !== newIsStarred
            ? {...row, is_starred_transaction: newIsStarred}
            : row;
        });
        return data.some((row, index) => row !== previousRows[index])
          ? {...oldResponse, json: {...oldResponse.json, data}}
          : undefined;
      }
    );
  };

  const {mutate} = useMutation({
    mutationKey: starredSegmentMutationKey,
    mutationFn: (star: boolean) =>
      star
        ? fetchMutation({url, method: 'POST', data: payload})
        : fetchMutation({url, method: 'DELETE', options: {query: payload}}),
    onMutate: updateTableData,
    onSuccess: (_, star) => {
      toast.success(star ? t('Transaction starred') : t('Transaction unstarred'));
    },
    onError: (_, star) => {
      toast.error(
        star ? t('Failed to star transaction') : t('Failed to unstar transaction')
      );
      updateTableData(!star);
    },
  });

  const setStarredSegment = (star: boolean) => {
    if (
      !selectedProjectId ||
      queryClient.isMutating({mutationKey: starredSegmentMutationKey})
    ) {
      return;
    }

    toast.loading(t('Saving changes...'));
    mutate(star);
  };

  return {setStarredSegment, isPending: isMutating > 0};
}
