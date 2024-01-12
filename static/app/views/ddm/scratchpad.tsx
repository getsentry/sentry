import {useCallback, useLayoutEffect} from 'react';
import styled from '@emotion/styled';
import * as echarts from 'echarts/core';

import {space} from 'sentry/styles/space';
import {MetricWidgetQueryParams} from 'sentry/utils/metrics';
import usePageFilters from 'sentry/utils/usePageFilters';
import {DDM_CHART_GROUP, MIN_WIDGET_WIDTH} from 'sentry/views/ddm/constants';
import {useDDMContext} from 'sentry/views/ddm/context';

import {MetricWidget} from './widget';

export function MetricScratchpad() {
  const {
    setSelectedWidgetIndex,
    selectedWidgetIndex,
    widgets,
    updateWidget,
    focusArea,
    addFocusArea,
    removeFocusArea,
  } = useDDMContext();
  const {selection} = usePageFilters();

  // Make sure all charts are connected to the same group whenever the widgets definition changes
  useLayoutEffect(() => {
    echarts.connect(DDM_CHART_GROUP);
  }, [widgets]);

  const handleChange = useCallback(
    (index: number, widget: Partial<MetricWidgetQueryParams>) => {
      updateWidget(index, widget);
    },
    [updateWidget]
  );

  const Wrapper =
    widgets.length === 1 ? StyledSingleWidgetWrapper : StyledMetricDashboard;

  return (
    <Wrapper>
      {widgets.map((widget, index) => (
        <MetricWidget
          key={index}
          index={index}
          onSelect={setSelectedWidgetIndex}
          isSelected={selectedWidgetIndex === index}
          hasSiblings={widgets.length > 1}
          onChange={handleChange}
          widget={widget}
          datetime={selection.datetime}
          projects={selection.projects}
          environments={selection.environments}
          addFocusArea={addFocusArea}
          removeFocusArea={removeFocusArea}
          focusArea={focusArea}
        />
      ))}
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
  grid-auto-rows: auto;
`;

const StyledSingleWidgetWrapper = styled('div')`
  display: grid;
  grid-template-columns: repeat(1, minmax(${MIN_WIDGET_WIDTH}px, 1fr));
`;
