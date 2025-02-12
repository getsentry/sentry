import styled from '@emotion/styled';

import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import Placeholder from 'sentry/components/placeholder';
import {IconCircleFill} from 'sentry/icons/iconCircleFill';
import {space} from 'sentry/styles/space';
import type {NewQuery} from 'sentry/types/organization';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {Color} from 'sentry/utils/theme';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import {useHasTraceNewUi} from './useHasTraceNewUi';
import {useTraceEventView} from './useTraceEventView';
import {type TraceViewQueryParams, useTraceQueryParams} from './useTraceQueryParams';

function useTraceLevelOpsQuery(
  traceSlug: string,
  params: TraceViewQueryParams,
  partialSavedQuery: Partial<NewQuery>,
  enabled: boolean
) {
  const location = useLocation();
  const organization = useOrganization();
  const eventView = useTraceEventView(traceSlug, params, {
    ...partialSavedQuery,
    dataset: DiscoverDatasets.SPANS_EAP,
  });

  return useDiscoverQuery({
    eventView,
    orgSlug: organization.slug,
    location,
    options: {
      enabled,
    },
  });
}

function LoadingPlaceHolder() {
  return (
    <Container>
      <StyledPlaceholder height={'16px'} width={'100px'} />
      <StyledPlaceholder height={'16px'} width={'100px'} />
      <StyledPlaceholder height={'16px'} width={'100px'} />
    </Container>
  );
}

type Props = {
  isTraceLoading: boolean;
  traceSlug: string;
};

export function TraceLevelOpsBreakdown({traceSlug, isTraceLoading}: Props) {
  const hasNewTraceUi = useHasTraceNewUi();
  const urlParams = useTraceQueryParams();
  const {
    data: opsCountsResult,
    isPending: isOpsCountsLoading,
    isError: isOpsCountsError,
  } = useTraceLevelOpsQuery(
    traceSlug ?? '',
    urlParams,
    {
      fields: ['span.op', 'count()'],
      orderby: '-count',
    },
    hasNewTraceUi
  );
  const {
    data: totalCountResult,
    isPending: isTotalCountLoading,
    isError: isTotalCountError,
  } = useTraceLevelOpsQuery(
    traceSlug ?? '',
    urlParams,
    {
      fields: ['count()'],
    },
    hasNewTraceUi
  );

  if (!hasNewTraceUi || isOpsCountsError || isTotalCountError) {
    return null;
  }

  if (isOpsCountsLoading || isTotalCountLoading || isTraceLoading) {
    return <LoadingPlaceHolder />;
  }

  const totalCount = totalCountResult?.data[0]?.['count()'] ?? 0;

  if (typeof totalCount !== 'number' || totalCount <= 0) {
    return null;
  }

  return (
    <Container>
      {opsCountsResult?.data.slice(0, 4).map(currOp => {
        const operationName = currOp['span.op'];
        const count = currOp['count()'];

        if (typeof operationName !== 'string' || typeof count !== 'number') {
          return null;
        }

        const percentage = count / totalCount;
        const color = pickBarColor(operationName);
        const pctLabel = isFinite(percentage) ? Math.round(percentage * 100) : '∞';

        return (
          <HighlightsOpRow key={operationName}>
            <IconCircleFill size="xs" color={color as Color} />
            {operationName}
            <span>{pctLabel}%</span>
          </HighlightsOpRow>
        );
      })}
    </Container>
  );
}

const HighlightsOpRow = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
  gap: 5px;
`;

const Container = styled('div')`
  display: flex;
  align-items: center;
  padding-left: ${space(1)};
  gap: ${space(2)};
`;

const StyledPlaceholder = styled(Placeholder)`
  border-radius: ${p => p.theme.borderRadius};
`;
