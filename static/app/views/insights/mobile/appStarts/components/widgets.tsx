import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import DeviceClassBreakdownBarChart from 'sentry/views/insights/mobile/appStarts/components/charts/deviceClassBreakdownBarChart';
import StartDurationWidget from 'sentry/views/insights/mobile/appStarts/components/startDurationWidget';

function SummaryWidgets({additionalFilters}) {
  return (
    <WidgetLayout>
      <div style={{gridArea: '1 / 1'}}>
        <StartDurationWidget additionalFilters={additionalFilters} chartHeight={120} />
      </div>
      <div style={{gridArea: '1 / 2'}}>
        <DeviceClassBreakdownBarChart
          additionalFilters={additionalFilters}
          chartHeight={120}
        />
      </div>
    </WidgetLayout>
  );
}

export default SummaryWidgets;

const WidgetLayout = styled('div')`
  display: grid;
  grid-template-rows: 200px;
  grid-template-columns: 1fr 1fr;
  gap: ${p => p.theme.space(1.5)};

  ${Panel} {
    height: 100%;
  }
`;
