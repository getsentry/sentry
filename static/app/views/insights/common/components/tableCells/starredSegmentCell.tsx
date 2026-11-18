import {IconStar} from '@sentry/icons/star';
import {useQueryClient} from '@tanstack/react-query';
import type {Simplify} from 'type-fest';

import {Button} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {FlexContainer} from 'sentry/utils/discover/styles';
import {useOrganization} from 'sentry/utils/useOrganization';
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

function isTableResponse(response: unknown): response is ApiResponse<TableData> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'json' in response &&
    typeof response.json === 'object' &&
    response.json !== null &&
    'data' in response.json &&
    Array.isArray(response.json.data)
  );
}

export function StarredSegmentCell({
  segmentName,
  isStarred,
  projectSlug,
  projectId,
}: Props) {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const {projects} = useProjects();
  const project = projects.find(p => p.slug === projectSlug);

  const {setStarredSegment, isPending} = useStarredSegment({
    projectId: project?.id || projectId,
    segmentName,
    onError: () => updateTableData(!isStarred),
  });

  const disabled = (!project && !projectId) || !segmentName || isPending;

  const updateTableData = (newIsStarred: boolean) => {
    queryClient.setQueriesData(
      {
        queryKey: apiOptions.queryKey('/organizations/$organizationIdOrSlug/events/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
      },
      (oldResponse: unknown) => {
        if (!isTableResponse(oldResponse)) {
          return oldResponse;
        }
        return {
          ...oldResponse,
          json: {
            ...oldResponse.json,
            data: oldResponse.json.data.map(row =>
              row.transaction === segmentName && 'is_starred_transaction' in row
                ? {...row, is_starred_transaction: newIsStarred}
                : row
            ),
          },
        };
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
