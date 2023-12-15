import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {SpanMetricsField} from 'sentry/views/starfish/types';

import AppStartBreakdownWidget from './appStartBreakdownWidget';

const {TRANSACTION} = SpanMetricsField;

const YAXIS_COLS = [
  // 'count_start(measurements.app_start_cold)',
  // 'count_start(measurements.app_start_warm)',
  'count()',
];

function SummaryWidgets({additionalFilters}) {
  return (
    <WidgetLayout>
      <WidgetPosition style={{gridArea: '1 / 1 / 1 / 1'}}>
        <AppStartBreakdownWidget height={140} />
      </WidgetPosition>

      {/* TODO: these are the new widgets that will populate the grid */}
      {/* <WidgetPosition style={{gridArea: '2 / 1 / 2 / 1'}}>
        System v Application
      </WidgetPosition>
      <WidgetPosition style={{gridArea: '1 / 2 / 1 / 2'}}>Cold Start</WidgetPosition>
      <WidgetPosition style={{gridArea: '2 / 2 / 2 / 2'}}>Warm Start</WidgetPosition>
      <WidgetPosition style={{gridArea: '1 / 3 / 2 / 3'}}>
        Dynamically loaded libraries
      </WidgetPosition>
      <WidgetPosition style={{gridArea: '2 / 3 / 3 / 3'}}>Count</WidgetPosition> */}
    </WidgetLayout>
  );
}

export default SummaryWidgets;

const WidgetPosition = styled('div')``;

const WidgetLayout = styled('div')`
  display: grid;
  grid-template-columns: 33% 33% 33%;
  grid-template-rows: 140px 140px;
  gap: ${space(1)};
`;
