import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import type {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import type {Location} from 'history';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import {HeaderTitle} from 'sentry/components/charts/styles';
import TransitionChart from 'sentry/components/charts/transitionChart';
import EmptyMessage from 'sentry/components/emptyMessage';
import TextOverflow from 'sentry/components/textOverflow';
import {IconSearch, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MRI, Organization, PageFilters} from 'sentry/types';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {stringifyMetricWidget} from 'sentry/utils/metrics';
import {
  MetricDisplayType,
  type MetricWidgetQueryParams,
} from 'sentry/utils/metrics/types';
import {useMetricsDataZoom} from 'sentry/utils/metrics/useMetricsData';
import {WidgetCardPanel, WidgetTitleRow} from 'sentry/views/dashboards/widgetCard';
import type {AugmentedEChartDataZoomHandler} from 'sentry/views/dashboards/widgetCard/chart';
import {DashboardsMEPContext} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import {InlineEditor} from 'sentry/views/dashboards/widgetCard/metricWidgetCard/inlineEditor';
import {Toolbar} from 'sentry/views/dashboards/widgetCard/toolbar';
import WidgetCardContextMenu from 'sentry/views/dashboards/widgetCard/widgetCardContextMenu';
import {MetricChart} from 'sentry/views/ddm/chart';
import {createChartPalette} from 'sentry/views/ddm/metricsChartPalette';
import {getChartTimeseries} from 'sentry/views/ddm/widget';
import {LoadingScreen} from 'sentry/views/starfish/components/chart';

import {
  convertToDashboardWidget,
  toMetricDisplayType,
} from '../../../../utils/metrics/dashboard';
import {parseField} from '../../../../utils/metrics/mri';
import {DASHBOARD_CHART_GROUP} from '../../dashboard';
import type {DashboardFilters, Widget} from '../../types';
import {useMetricsDashboardContext} from '../metricsContext';

type Props = {
  isEditingDashboard: boolean;
  location: Location;
  organization: Organization;
  router: InjectedRouter;
  selection: PageFilters;
  widget: Widget;
  dashboardFilters?: DashboardFilters;
  index?: string;
  isEditingWidget?: boolean;
  isMobile?: boolean;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onEdit?: (index: string) => void;
  onUpdate?: (widget: Widget | null) => void;
  onZoom?: AugmentedEChartDataZoomHandler;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
  showSlider?: boolean;
  tableItemLimit?: number;
  windowWidth?: number;
};

export function MetricWidgetCard({
  organization,
  selection,
  widget,
  isEditingWidget,
  isEditingDashboard,
  onEdit,
  onUpdate,
  onDelete,
  onDuplicate,
  location,
  router,
  index,
  dashboardFilters,
  renderErrorMessage,
}: Props) {
  useMetricsDashboardContext();

  const [metricWidgetQueryParams, setMetricWidgetQueryParams] =
    useState<MetricWidgetQueryParams>(convertFromWidget(widget));

  const defaultTitle = useMemo(
    () => stringifyMetricWidget(metricWidgetQueryParams),
    [metricWidgetQueryParams]
  );

  const [title, setTitle] = useState<string>(widget.title ?? defaultTitle);

  const handleChange = useCallback(
    (data: Partial<MetricWidgetQueryParams>) => {
      setMetricWidgetQueryParams(curr => ({
        ...curr,
        ...data,
      }));
    },
    [setMetricWidgetQueryParams]
  );

  const handleSubmit = useCallback(() => {
    const convertedWidget = convertToDashboardWidget(
      {...selection, ...metricWidgetQueryParams},
      toMetricDisplayType(metricWidgetQueryParams.displayType)
    );

    const isCustomTitle = title !== '' && title !== defaultTitle;

    const updatedWidget = {
      ...widget,
      // If user renamed the widget, preserve that title, otherwise stringify the widget query params
      title: isCustomTitle ? title : defaultTitle,
      queries: convertedWidget.queries,
      displayType: convertedWidget.displayType,
    };

    onUpdate?.(updatedWidget);
  }, [title, defaultTitle, metricWidgetQueryParams, onUpdate, widget, selection]);

  const handleCancel = useCallback(() => {
    onUpdate?.(null);
  }, [onUpdate]);

  if (!metricWidgetQueryParams.mri) {
    return (
      <ErrorPanel height="200px">
        <IconWarning color="gray300" size="lg" />
      </ErrorPanel>
    );
  }

  return (
    <DashboardsMEPContext.Provider
      value={{
        isMetricsData: undefined,
        setIsMetricsData: () => {},
      }}
    >
      <WidgetCardPanel isDragging={false}>
        <WidgetHeaderWrapper>
          {isEditingWidget ? (
            <InlineEditor
              isEdit={!!isEditingWidget}
              displayType={metricWidgetQueryParams.displayType}
              metricsQuery={metricWidgetQueryParams}
              projects={selection.projects}
              powerUserMode={false}
              onChange={handleChange}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              onTitleChange={setTitle}
              title={title}
            />
          ) : (
            <WidgetHeaderDescription>
              <WidgetTitleRow>
                <WidgetTitle>
                  <TextOverflow>{title}</TextOverflow>
                </WidgetTitle>
              </WidgetTitleRow>
            </WidgetHeaderDescription>
          )}

          <ContextMenuWrapper>
            {!isEditingDashboard && (
              <WidgetCardContextMenu
                organization={organization}
                widget={widget}
                selection={selection}
                showContextMenu
                isPreview={false}
                widgetLimitReached={false}
                onEdit={() => index && onEdit?.(index)}
                router={router}
                location={location}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
              />
            )}
          </ContextMenuWrapper>
        </WidgetHeaderWrapper>

        <MetricWidgetChartContainer
          selection={selection}
          widget={widget}
          editorParams={metricWidgetQueryParams}
          dashboardFilters={dashboardFilters}
          renderErrorMessage={renderErrorMessage}
        />
        {isEditingDashboard && <Toolbar onDelete={onDelete} onDuplicate={onDuplicate} />}
      </WidgetCardPanel>
    </DashboardsMEPContext.Provider>
  );
}

type MetricWidgetChartContainerProps = {
  selection: PageFilters;
  widget: Widget;
  dashboardFilters?: DashboardFilters;
  editorParams?: Partial<MetricWidgetQueryParams>;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
};

export function MetricWidgetChartContainer({
  selection,
  widget,
  editorParams = {},
  dashboardFilters,
  renderErrorMessage,
}: MetricWidgetChartContainerProps) {
  const metricWidgetQueryParams = {
    ...convertFromWidget(widget),
    ...editorParams,
  };

  const {projects, environments, datetime} = selection;
  const {mri, op, groupBy, displayType} = metricWidgetQueryParams;

  const {
    data: timeseriesData,
    isLoading,
    isError,
    error,
  } = useMetricsDataZoom(
    {
      mri,
      op,
      query: extendQuery(metricWidgetQueryParams.query, dashboardFilters),
      groupBy,
      projects,
      environments,
      datetime,
    },
    {fidelity: displayType === MetricDisplayType.BAR ? 'low' : 'high'}
  );

  const chartRef = useRef<ReactEchartsRef>(null);

  const chartSeries = useMemo(() => {
    return timeseriesData
      ? getChartTimeseries(timeseriesData, {
          getChartPalette: createChartPalette,
          mri,
        })
      : [];
  }, [timeseriesData, mri]);

  if (isError) {
    const errorMessage =
      error?.responseJSON?.detail?.toString() || t('Error while fetching metrics data');
    return (
      <Fragment>
        {renderErrorMessage?.(errorMessage)}
        <ErrorPanel>
          <IconWarning color="gray500" size="lg" />
        </ErrorPanel>
      </Fragment>
    );
  }

  if (timeseriesData?.groups.length === 0) {
    return (
      <EmptyMessage
        icon={<IconSearch size="xxl" />}
        title={t('No results')}
        description={t('No results found for the given query')}
      />
    );
  }

  return (
    <MetricWidgetChartWrapper>
      <TransitionChart loading={isLoading} reloading={isLoading}>
        <LoadingScreen loading={isLoading} />
        <MetricChart
          ref={chartRef}
          series={chartSeries}
          displayType={displayType}
          operation={op}
          widgetIndex={0}
          group={DASHBOARD_CHART_GROUP}
        />
      </TransitionChart>
    </MetricWidgetChartWrapper>
  );
}

function extendQuery(query = '', dashboardFilters?: DashboardFilters) {
  if (!dashboardFilters?.release?.length) {
    return query;
  }

  const releaseQuery = convertToQuery(dashboardFilters);

  return `${query} ${releaseQuery}`;
}

function convertToQuery(dashboardFilters: DashboardFilters) {
  const {release} = dashboardFilters;

  if (!release?.length) {
    return '';
  }

  if (release.length === 1) {
    return `release:${release[0]}`;
  }

  return `release:[${release.join(',')}]`;
}

function convertFromWidget(widget: Widget): MetricWidgetQueryParams {
  const query = widget.queries[0];
  const parsed = parseField(query.aggregates[0]) || {mri: '' as MRI, op: ''};

  return {
    mri: parsed.mri,
    op: parsed.op,
    query: query.conditions,
    groupBy: query.columns,
    title: widget.title,
    displayType: toMetricDisplayType(widget.displayType),
  };
}

const WidgetHeaderWrapper = styled('div')`
  min-height: 36px;
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
`;

const ContextMenuWrapper = styled('div')`
  padding: ${space(2)} ${space(1)} 0 ${space(3)};
`;

const WidgetHeaderDescription = styled('div')`
  ${p => p.theme.overflowEllipsis};
  overflow-y: visible;
`;

const WidgetTitle = styled(HeaderTitle)`
  padding-left: ${space(3)};
  padding-top: ${space(2)};
  padding-right: ${space(1)};
  ${p => p.theme.overflowEllipsis};
  font-weight: normal;
`;

const MetricWidgetChartWrapper = styled('div')`
  height: 100%;
  width: 100%;
  padding: ${space(3)};
  padding-top: ${space(2)};
  `;
