import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {space} from 'sentry/styles/space';
import {getDurationUnit} from 'sentry/utils/discover/charts';
import {useInteractionBreakdownTimeseriesQuery} from 'sentry/views/performance/browser/interactionSummary/useInteractionBreakdownTimeseriesQuery';
import Chart from 'sentry/views/starfish/components/chart';

type Props = {};

export function InteractionBreakdownChart(props: Props) {
  const {data, isLoading} = useInteractionBreakdownTimeseriesQuery({
    operation: 'ui.action.click',
    element: 'input.app-6fjtrc.e1mw05q50[type="range"][name="replay-timeline"]',
    page: '/replays/:replaySlug/',
  });

  return (
    <ChartContainer>
      <Chart
        height={200}
        data={data}
        loading={isLoading}
        utc={false}
        chartColors={[CHART_PALETTE[0][0]]}
        durationUnit={getDurationUnit(data)}
        aggregateOutputFormat={'duration'}
        grid={{
          left: 20,
          right: 50,
          top: 30,
          bottom: 10,
        }}
      />
    </ChartContainer>
  );
}

const ChartContainer = styled('div')`
  flex: 1;
  border: 1px solid ${p => p.theme.gray200};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(4)};
`;
