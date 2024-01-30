import {useCallback, useLayoutEffect} from 'react';
import styled from '@emotion/styled';
import * as echarts from 'echarts/core';

import {space} from 'sentry/styles/space';
import {getMetricsCorrelationSpanUrl} from 'sentry/utils/metrics';
import type {MetricWidgetQueryParams} from 'sentry/utils/metrics/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {DDM_CHART_GROUP, MIN_WIDGET_WIDTH} from 'sentry/views/ddm/constants';
import {useDDMContext} from 'sentry/views/ddm/context';

import type {Sample} from './widget';
import {MetricWidget} from './widget';

export function MetricScratchpad() {
  const {
    setSelectedWidgetIndex,
    selectedWidgetIndex,
    widgets,
    updateWidget,
    showQuerySymbols,
    highlightedSampleId,
    focusArea,
  } = useDDMContext();
  const {selection} = usePageFilters();

  const router = useRouter();
  const organization = useOrganization();
  const {projects} = useProjects();

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

  const handleSampleClick = useCallback(
    (sample: Sample) => {
      const project = projects.find(p => parseInt(p.id, 10) === sample.projectId);
      router.push(
        getMetricsCorrelationSpanUrl(
          organization,
          project?.slug,
          sample.spanId,
          sample.transactionId,
          sample.transactionSpanId
        )
      );
    },
    [projects, router, organization]
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
          focusArea={focusArea}
          showQuerySymbols={showQuerySymbols}
          onSampleClick={handleSampleClick}
          highlightedSampleId={highlightedSampleId}
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
