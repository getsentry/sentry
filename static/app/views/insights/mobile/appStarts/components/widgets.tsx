import styled from '@emotion/styled';

import {Panel} from 'sentry/components/panels/panel';
import {DeviceClassBreakdownBarChart} from 'sentry/views/insights/mobile/appStarts/components/charts/deviceClassBreakdownBarChart';
import {StartDurationWidget} from 'sentry/views/insights/mobile/appStarts/components/startDurationWidget';

export function SummaryWidgets({additionalFilters}: any) {
  return (
    <WidgetLayout>
      <div style={{gridArea: '1 / 1'}}>
        <StartDurationWidget additionalFilters={additionalFilters} />
      </div>
      <div style={{gridArea: '1 / 2'}}>
        <DeviceClassBreakdownBarChart
          additionalFilters={additionalFilters}
          chartHeight={220}
        />
      </div>
    </WidgetLayout>
  );
}

const WidgetLayout = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${p => p.theme.space.xl};

  ${Panel} {
    height: 100%;
  }
`;
