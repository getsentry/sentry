import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import CountWidget from 'sentry/views/starfish/views/appStartup/screenSummary/countWidget';

import AppStartBreakdownWidget from './appStartBreakdownWidget';

function SummaryWidgets({additionalFilters}) {
  return (
    <WidgetLayout>
      <div style={{gridArea: '1 / 1 / 1 / 1'}}>
        <AppStartBreakdownWidget additionalFilters={additionalFilters} />
      </div>
      <div style={{gridArea: '2 / 1 / 2 / 1'}}>
        <CountWidget additionalFilters={additionalFilters} />
      </div>
    </WidgetLayout>
  );
}

export default SummaryWidgets;

const WidgetLayout = styled('div')`
  display: grid;
  grid-template-columns: 33% 33% 33%;
  grid-template-rows: 140px 140px;
  gap: ${space(1)};
`;
