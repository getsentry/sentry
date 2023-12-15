import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

function SummaryWidgets() {
  return (
    <WidgetLayout>
      <WidgetPosition style={{gridArea: '1 / 1 / 1 / 1'}}>App Start</WidgetPosition>
      <WidgetPosition style={{gridArea: '2 / 1 / 2 / 1'}}>Count</WidgetPosition>
      <WidgetPosition style={{gridArea: '1 / 2 / 1 / 2'}}>Cold Start</WidgetPosition>
      <WidgetPosition style={{gridArea: '2 / 2 / 2 / 2'}}>Warm Start</WidgetPosition>
      <WidgetPosition style={{gridArea: '1 / 3 / 3 / 3'}}>
        Framework Initializer functions
      </WidgetPosition>
    </WidgetLayout>
  );
}

export default SummaryWidgets;

const WidgetPosition = styled('div')`
  background: lightgray;
  border: 1px solid black;
  border-radius: 4px;
`;

const WidgetLayout = styled('div')`
  display: grid;
  grid-template-columns: 33% 33% 33%;
  grid-template-rows: 140px 140px;
  gap: ${space(1)};
`;
