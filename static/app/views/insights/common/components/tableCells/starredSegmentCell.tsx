import type {Simplify} from 'type-fest';

import {Button} from 'sentry/components/core/button';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {FlexContainer} from 'sentry/utils/discover/styles';
import {useQueryClient} from 'sentry/utils/queryClient';
import useProjects from 'sentry/utils/useProjects';
import {useStarredSegment} from 'sentry/views/insights/common/utils/useStarredSegment';
import type {SpanResponse} from 'sentry/views/insights/types';

interface Props {
  isStarred: boolean;
  projectSlug: string;
  segmentName: string;
}

type TableRow = Simplify<
  Partial<SpanResponse> & Pick<SpanResponse, 'is_starred_transaction' | 'transaction'>
>;

type TableResponse = [{confidence: any; meta: EventsMetaType; data?: TableRow[]}];

// The query key used for the starred segments table request, this key is used to reference that query and update the starred segment state
export const STARRED_SEGMENT_TABLE_QUERY_KEY = ['starred-segment-table'];

export function StarredSegmentCell({segmentName, isStarred, projectSlug}: Props) {
  const queryClient = useQueryClient();
  const {projects} = useProjects();
  const project = projects.find(p => p.slug === projectSlug);

  const {setStarredSegment, isPending} = useStarredSegment({
    projectId: project?.id,
    segmentName,
    onError: () => updateTableData(!isStarred),
  });

  const disabled = !project || !segmentName || isPending;

  const updateTableData = (newIsStarred: boolean) => {
    queryClient.setQueriesData(
      {queryKey: STARRED_SEGMENT_TABLE_QUERY_KEY},
      (oldResponse: TableResponse | any): TableResponse | any => {
        if (!oldResponse) {
          return oldResponse;
        }

        // Handles `useSpans` format: [{confidence, meta, data}]
        if (oldResponse?.[0]?.data && !oldResponse?.[1]) {
          const oldTableData = oldResponse[0].data || [];
          const newData = oldTableData.map((row: TableRow): TableRow => {
            if (row.transaction === segmentName) {
              return {
                ...row,
                is_starred_transaction: newIsStarred,
              };
            }
            return row;
          });
          return [{...oldResponse[0], data: newData}];
        }

        // Handles `useSpansWidgetQuery` format: [responseData, headers, responseMeta]
        // TODO: unify the format of the response data
        if (oldResponse?.[0]?.data && oldResponse?.[1]) {
          const responseData = oldResponse[0];
          const oldTableData = responseData.data || [];
          const newData = oldTableData.map((row: TableRow): TableRow => {
            if (row.transaction === segmentName) {
              return {
                ...row,
                is_starred_transaction: newIsStarred,
              };
            }
            return row;
          });
          return [{...responseData, data: newData}, oldResponse[1], oldResponse[2]];
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
        priority="transparent"
        size="zero"
        icon={
          <IconStar
            variant={isStarred ? 'warning' : 'muted'}
            isSolid={isStarred}
            data-test-id="starred-transaction-column"
          />
        }
        aria-label={t('Toggle star for transaction')}
      />
    </FlexContainer>
  );
}
