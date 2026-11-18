import {IconStar} from '@sentry/icons/star';
import {useQueryClient} from '@tanstack/react-query';
import type {Simplify} from 'type-fest';

import {Button} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {FlexContainer} from 'sentry/utils/discover/styles';
import {useProjects} from 'sentry/utils/useProjects';
import {useStarredSegment} from 'sentry/views/insights/common/utils/useStarredSegment';
import type {SpanResponse} from 'sentry/views/insights/types';

interface Props {
  isStarred: boolean;
  segmentName: string;
  projectId?: string;
  projectSlug?: string;
}

type TableRow = Simplify<
  Partial<SpanResponse> & Pick<SpanResponse, 'is_starred_transaction' | 'transaction'>
>;

type TableData = {data: TableRow[]};

function isTableData(value: unknown): value is TableData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    Array.isArray(value.data)
  );
}

// `useSpansWidgetQuery` fetches with `apiFetch`
function isApiResponse(response: unknown): response is ApiResponse<TableData> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'json' in response &&
    isTableData(response.json)
  );
}

// `useGenericDiscoverQuery` caches `[data, statusText, responseMeta]`
function isDiscoverResponse(response: unknown): response is [TableData, ...unknown[]] {
  return Array.isArray(response) && isTableData(response[0]);
}

// The query key used for the starred segments table request, this key is used to reference that query and update the starred segment state
export const STARRED_SEGMENT_TABLE_QUERY_KEY = ['starred-segment-table'];

export function StarredSegmentCell({
  segmentName,
  isStarred,
  projectSlug,
  projectId,
}: Props) {
  const queryClient = useQueryClient();
  const {projects} = useProjects();
  const project = projects.find(p => p.slug === projectSlug);

  const {setStarredSegment, isPending} = useStarredSegment({
    projectId: project?.id || projectId,
    segmentName,
    onError: () => updateTableData(!isStarred),
  });

  const disabled = (!project && !projectId) || !segmentName || isPending;

  const updateTableData = (newIsStarred: boolean) => {
    const updateRows = (tableData: TableData): TableData => ({
      ...tableData,
      data: tableData.data.map(row =>
        row.transaction === segmentName
          ? {...row, is_starred_transaction: newIsStarred}
          : row
      ),
    });

    queryClient.setQueriesData(
      {queryKey: STARRED_SEGMENT_TABLE_QUERY_KEY},
      (oldResponse: unknown) => {
        if (isApiResponse(oldResponse)) {
          return {...oldResponse, json: updateRows(oldResponse.json)};
        }
        if (isDiscoverResponse(oldResponse)) {
          const [tableData, ...rest] = oldResponse;
          return [updateRows(tableData), ...rest];
        }
        return oldResponse;
      }
    );
  };

  const toggleStarredTransaction = () => {
    setStarredSegment(!isStarred);
    updateTableData(!isStarred);
  };

  return (
    <FlexContainer>
      <Button
        onClick={toggleStarredTransaction}
        disabled={disabled}
        variant="transparent"
        size="zero"
        icon={
          <IconStar
            variant={isStarred ? 'warning' : 'muted'}
            isSolid={isStarred}
            size="sm"
            data-test-id="starred-transaction-column"
          />
        }
        aria-label={t('Toggle star for transaction')}
      />
    </FlexContainer>
  );
}
