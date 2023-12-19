import styled from '@emotion/styled';

import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {space} from 'sentry/styles/space';
import {getDurationUnit} from 'sentry/utils/discover/charts';
import {useInteractionBreakdownTimeseriesQuery} from 'sentry/views/performance/browser/interactionSummary/useInteractionBreakdownTimeseriesQuery';
import Chart from 'sentry/views/starfish/components/chart';

type Props = {
  element: string;
  operation: string;
  page: string;
};

export function InteractionBreakdownChart({operation, element, page}: Props) {
  const {data, isLoading} = useInteractionBreakdownTimeseriesQuery({
    operation,
    element,
    page,
  });

  return (
    <ChartContainer>
      <Chart
        height={200}
        data={data}
        loading={isLoading}
        chartColors={[CHART_PALETTE[0][0]]}
        durationUnit={getDurationUnit(data)}
        aggregateOutputFormat="duration"
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
