import {useCallback, useLayoutEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import * as echarts from 'echarts/core';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {Field} from 'sentry/components/metrics/metricSamplesTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getMetricsCorrelationSpanUrl} from 'sentry/utils/metrics';
import {
  isMetricsEquationWidget,
  MetricExpressionType,
  type MetricsWidget,
} from 'sentry/utils/metrics/types';
import type {MetricsQueryApiQueryParams} from 'sentry/utils/metrics/useMetricsQuery';
import type {MetricsSamplesResults} from 'sentry/utils/metrics/useMetricsSamples';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {DDM_CHART_GROUP, MIN_WIDGET_WIDTH} from 'sentry/views/metrics/constants';
import {useMetricsContext} from 'sentry/views/metrics/context';
import {useGetCachedChartPalette} from 'sentry/views/metrics/utils/metricsChartPalette';
import {useFormulaDependencies} from 'sentry/views/metrics/utils/useFormulaDependencies';
import {widgetToQuery} from 'sentry/views/metrics/utils/widgetToQuery';

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
    isMultiChartMode,
    metricsSamples,
  } = useMetricsContext();
  const {selection} = usePageFilters();

  const router = useRouter();
  const organization = useOrganization();
  const getChartPalette = useGetCachedChartPalette();

  // Make sure all charts are connected to the same group whenever the widgets definition changes
  useLayoutEffect(() => {
    echarts.connect(DDM_CHART_GROUP);
  }, [widgets]);

  const handleChange = useCallback(
    (index: number, widget: Partial<MetricsWidget>) => {
      updateWidget(index, widget);
    },
    [updateWidget]
  );

  const handleSampleClick = useCallback(
    (sample: MetricsSamplesResults<Field>['data'][number]) => {
      if (!sample['transaction.id']) {
        addErrorMessage(t('No matching transaction found'));
        return;
      }
      router.push(
        getMetricsCorrelationSpanUrl(
          organization,
          sample.project,
          sample.id,
          sample['transaction.id'],
          sample['segment.id']
        )
      );
    },
    [router, organization]
  );

  const firstWidget = widgets[0];

  const Wrapper =
    !isMultiChartMode || widgets.length === 1
      ? StyledSingleWidgetWrapper
      : StyledMetricDashboard;

  const formulaDependencies = useFormulaDependencies();

  const filteredWidgets = useMemo(() => {
    return widgets.filter(
      w =>
        w.type !== MetricExpressionType.EQUATION ||
        formulaDependencies[w.id]?.isError === false
    );
  }, [formulaDependencies, widgets]);

  return (
    <Wrapper>
      {isMultiChartMode ? (
        filteredWidgets.map((widget, index) =>
          widget.isHidden ? null : (
            <MultiChartWidgetQueries
              formulaDependencies={formulaDependencies}
              widget={widget}
              key={`${widget.type}_${widget.id}`}
            >
              {queries => (
                <MetricWidget
                  queryId={widget.id}
                  index={index}
                  getChartPalette={getChartPalette}
                  onSelect={setSelectedWidgetIndex}
                  displayType={widget.displayType}
                  focusedSeries={widget.focusedSeries}
                  tableSort={widget.sort}
                  queries={queries}
                  isSelected={selectedWidgetIndex === index}
                  hasSiblings={widgets.length > 1}
                  onChange={handleChange}
                  filters={selection}
                  focusAreaProps={focusArea}
                  showQuerySymbols={showQuerySymbols}
                  onSampleClick={handleSampleClick}
                  chartHeight={200}
                  highlightedSampleId={
                    selectedWidgetIndex === index ? highlightedSampleId : undefined
                  }
                  metricsSamples={metricsSamples}
                />
              )}
            </MultiChartWidgetQueries>
          )
        )
      ) : (
        <MetricWidget
          index={0}
          getChartPalette={getChartPalette}
          onSelect={setSelectedWidgetIndex}
          displayType={firstWidget.displayType}
          focusedSeries={firstWidget.focusedSeries}
          tableSort={firstWidget.sort}
          queries={filteredWidgets
            .filter(w => !(w.type === MetricExpressionType.EQUATION && w.isHidden))
            .map(w => widgetToQuery(w))}
          isSelected
          hasSiblings={false}
          onChange={handleChange}
          filters={selection}
          focusAreaProps={focusArea}
          showQuerySymbols={false}
          onSampleClick={handleSampleClick}
          chartHeight={200}
          highlightedSampleId={highlightedSampleId}
          metricsSamples={metricsSamples}
        />
      )}
    </Wrapper>
  );
}

function MultiChartWidgetQueries({
  widget,
  formulaDependencies,
  children,
}: {
  children: (queries: MetricsQueryApiQueryParams[]) => JSX.Element;
  formulaDependencies: ReturnType<typeof useFormulaDependencies>;
  widget: MetricsWidget;
}) {
  const queries = useMemo(() => {
    return [
      widgetToQuery(widget),
      ...(isMetricsEquationWidget(widget)
        ? formulaDependencies[widget.id]?.dependencies?.map(dependency =>
            widgetToQuery(dependency, true)
          )
        : []),
    ];
  }, [widget, formulaDependencies]);

  return children(queries);
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
