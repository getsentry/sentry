import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import ResourceLandingDurationChartWidget from 'sentry/views/insights/common/components/widgets/resourceLandingDurationChartWidget';
import ResourceLandingThroughputChartWidget from 'sentry/views/insights/common/components/widgets/resourceLandingThroughputChartWidget';

export function ResourceLandingPageCharts() {
  return (
    <ChartsContainer>
      <ChartsContainerItem>
        <ResourceLandingThroughputChartWidget />
      </ChartsContainerItem>

      <ChartsContainerItem>
        <ResourceLandingDurationChartWidget />
      </ChartsContainerItem>
    </ChartsContainer>
  );
}

const ChartsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

const ChartsContainerItem = styled('div')`
  flex: 1;
`;
