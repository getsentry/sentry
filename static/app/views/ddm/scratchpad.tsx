import styled from '@emotion/styled';
import * as echarts from 'echarts/core';

import {Button} from 'sentry/components/button';
import Panel from 'sentry/components/panels/panel';
import {IconAdd} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import usePageFilters from 'sentry/utils/usePageFilters';
import {DDM_CHART_GROUP, MIN_WIDGET_WIDTH} from 'sentry/views/ddm/constants';

import {MetricWidget, useMetricWidgets} from './widget';

export function MetricScratchpad() {
  const {widgets, onChange, addWidget} = useMetricWidgets();
  const {selection} = usePageFilters();

  const Wrapper =
    widgets.length === 1 ? StyledSingleWidgetWrapper : StyledMetricDashboard;

  echarts.connect(DDM_CHART_GROUP);

  return (
    <Wrapper>
      {widgets.map(widget => (
        <MetricWidget
          key={widget.position}
          widget={{
            ...widget,
            onChange: data => {
              onChange(widget.position, data);
            },
          }}
          datetime={selection.datetime}
          projects={selection.projects}
          environments={selection.environments}
        />
      ))}
      <AddWidgetPanel onClick={addWidget}>
        <Button icon={<IconAdd isCircled />}>Add widget</Button>
      </AddWidgetPanel>
    </Wrapper>
  );
}

const StyledMetricDashboard = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, minmax(${MIN_WIDGET_WIDTH}px, 1fr));
  gap: ${space(2)};

  @media (max-width: ${props => props.theme.breakpoints.xxlarge}) {
    grid-template-columns: repeat(2, minmax(${MIN_WIDGET_WIDTH}px, 1fr));
  }
  @media (max-width: ${props => props.theme.breakpoints.xlarge}) {
    grid-template-columns: repeat(1, minmax(${MIN_WIDGET_WIDTH}px, 1fr));
  }
  grid-auto-rows: 1fr;
`;

const StyledSingleWidgetWrapper = styled('div')`
  display: grid;
  grid-template-columns: minmax(${MIN_WIDGET_WIDTH}px, 90%) minmax(180px, 10%);

  @media (max-width: ${props => props.theme.breakpoints.xlarge}) {
    grid-template-columns: repeat(1, minmax(${MIN_WIDGET_WIDTH}px, 1fr));
  }

  gap: ${space(2)};

  grid-auto-rows: 1fr;
`;

const AddWidgetPanel = styled(Panel)`
  width: 100%;
  height: 100%;
  margin-bottom: 0;
  padding: ${space(4)};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px dashed ${p => p.theme.border};

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
    cursor: pointer;
  }
`;
