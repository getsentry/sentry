import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import ResourceLandingDurationChartWidget from 'sentry/views/insights/common/components/widgets/resourceLandingDurationChartWidget';
import ResourceLandingThroughputChartWidget from 'sentry/views/insights/common/components/widgets/resourceLandingThroughputChartWidget';

export function ResourceLandingPageCharts() {
  return (
    <Flex wrap="wrap" gap="xl">
      <ChartsContainerItem>
        <ResourceLandingThroughputChartWidget />
      </ChartsContainerItem>

      <ChartsContainerItem>
        <ResourceLandingDurationChartWidget />
      </ChartsContainerItem>
    </Flex>
  );
}

const ChartsContainerItem = styled('div')`
  flex: 1;
`;
