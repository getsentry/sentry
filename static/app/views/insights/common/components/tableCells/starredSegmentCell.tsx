import {IconStar} from '@sentry/icons/star';
import {useQueryClient} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';
import {FlexContainer} from 'sentry/utils/discover/styles';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useStarredSegment} from 'sentry/views/insights/common/utils/useStarredSegment';
import type {SpanResponse} from 'sentry/views/insights/types';

export const STARRED_SEGMENT_TABLE_QUERY_KEY = 'starred-segment-table';

interface Props {
  isStarred: boolean;
  segmentName: string;
  projectId?: string;
  projectSlug?: string;
}

type TableRow = Pick<SpanResponse, 'transaction'> &
  Partial<Pick<SpanResponse, 'is_starred_transaction' | 'project' | 'project.id'>>;
type TableData = {data: TableRow[]};

export function StarredSegmentCell({
  segmentName,
  isStarred,
  projectSlug,
  projectId,
}: Props) {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const {projects} = useProjects();
  const project =
    projects.find(p => p.slug === projectSlug) ?? projects.find(p => p.id === projectId);
  const selectedProjectId = project?.id ?? projectId;
  const selectedProjectSlug = project?.slug ?? projectSlug;

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

  const {setStarredSegment, isPending} = useStarredSegment({
    projectId: selectedProjectId,
    segmentName,
    onError: updateTableData,
  });

  const disabled = !selectedProjectId || !segmentName || isPending;

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
