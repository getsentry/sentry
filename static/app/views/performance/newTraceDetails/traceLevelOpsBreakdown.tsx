import styled from '@emotion/styled';

import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import Placeholder from 'sentry/components/placeholder';
import {IconCircleFill} from 'sentry/icons/iconCircleFill';
import {space} from 'sentry/styles/space';
import type {Color} from 'sentry/utils/theme';

import type {TraceMetaQueryResults} from './traceApi/useTraceMeta';
import {useHasTraceNewUi} from './useHasTraceNewUi';

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
  metaQueryResults: TraceMetaQueryResults;
};

export function TraceLevelOpsBreakdown({metaQueryResults, isTraceLoading}: Props) {
  const hasNewTraceUi = useHasTraceNewUi();

  if (!hasNewTraceUi || metaQueryResults.status === 'error') {
    return null;
  }

  if (isTraceLoading || metaQueryResults.status === 'pending') {
    return <LoadingPlaceHolder />;
  }

  const {span_count, span_count_map} = metaQueryResults.data!;

  if (span_count <= 0) {
    return null;
  }

  return (
    <Container>
      {Object.entries(span_count_map)
        .sort((a, b) => b[1] - a[1]) // Sort by count
        .slice(0, 4)
        .map(([op, count]) => {
          const percentage = count / span_count;
          const color = pickBarColor(op);
          const pctLabel = isFinite(percentage) ? Math.round(percentage * 100) : '∞';

          return (
            <HighlightsOpRow key={op}>
              <IconCircleFill size="xs" color={color as Color} />
              {op}
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
