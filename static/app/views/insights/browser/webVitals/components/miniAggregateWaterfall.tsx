import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {noFilter} from 'sentry/components/events/interfaces/spans/filter';
import {ActualMinimap} from 'sentry/components/events/interfaces/spans/header';
import {useSpanWaterfallModelFromTransaction} from 'sentry/components/events/interfaces/spans/useSpanWaterfallModelFromTransaction';
import OpsBreakdown from 'sentry/components/events/opsBreakdown';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {space} from 'sentry/styles/space';

type Props = {
  transaction: string;
  aggregateSpansLocation?: Location;
};

export function MiniAggregateWaterfall({transaction}: Props) {
  const theme = useTheme();

  // Pageload transactions don't seem to store http.method, so don't include one here
  const {waterfallModel, event, isLoading} =
    useSpanWaterfallModelFromTransaction(transaction);
  if (isLoading) {
    return <LoadingIndicator />;
  }
  const minimap = (
    <ActualMinimap
      theme={theme}
      spans={waterfallModel.getWaterfall({
        viewStart: 0,
        viewEnd: 1,
      })}
      generateBounds={waterfallModel.generateBounds({
        viewStart: 0,
        viewEnd: 1,
      })}
      dividerPosition={0}
      rootSpan={waterfallModel.rootSpan.span}
    />
  );
  const opsBreakdown = (
    <OpsBreakdown operationNameFilters={noFilter} event={event} topN={3} hideHeader />
  );
  return (
    <span>
      <MinimapContainer>{minimap}</MinimapContainer>
      <BreakdownContainer>{opsBreakdown}</BreakdownContainer>
    </span>
  );
}

const MinimapContainer = styled('div')`
  position: relative;
  height: 120px;
`;

// Not ideal, but OpsBreakdown has margins in nested components. Easiest way to update them for now.
const BreakdownContainer = styled('div')`
  > div {
    margin: 0;
  }
  margin: ${space(2)} 0;
`;
