import {useMemo} from 'react';
import type {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {ErrorBoundary} from '@sentry/react';
import type {Location} from 'history';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import {HeaderTitle} from 'sentry/components/charts/styles';
import TextOverflow from 'sentry/components/textOverflow';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, PageFilters} from 'sentry/types';
import {useMetricsQuery} from 'sentry/utils/metrics/useMetricsQuery';
import {MetricBigNumberContainer} from 'sentry/views/dashboards/metrics/bigNumber';
import {MetricChartContainer} from 'sentry/views/dashboards/metrics/chart';
import {MetricTableContainer} from 'sentry/views/dashboards/metrics/table';
import {
  expressionsToApiQueries,
  getMetricExpressions,
  toMetricDisplayType,
} from 'sentry/views/dashboards/metrics/utils';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import {WidgetCardPanel, WidgetTitleRow} from 'sentry/views/dashboards/widgetCard';
import {DashboardsMEPContext} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import {Toolbar} from 'sentry/views/dashboards/widgetCard/toolbar';
import WidgetCardContextMenu from 'sentry/views/dashboards/widgetCard/widgetCardContextMenu';
import {getWidgetTitle} from 'sentry/views/metrics/widget';

type Props = {
  isEditingDashboard: boolean;
  location: Location;
  organization: Organization;
  router: InjectedRouter;
  selection: PageFilters;
  widget: Widget;
  dashboardFilters?: DashboardFilters;
  index?: string;
  isMobile?: boolean;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onEdit?: (index: string) => void;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
  showContextMenu?: boolean;
};

export function MetricWidgetCard({
  organization,
  selection,
  widget,
  isEditingDashboard,
  onDelete,
  onDuplicate,
  location,
  router,
  dashboardFilters,
  renderErrorMessage,
  showContextMenu = true,
}: Props) {
  const metricQueries = useMemo(
    () => expressionsToApiQueries(getMetricExpressions(widget, dashboardFilters)),
    [widget, dashboardFilters]
  );

  const widgetMQL = useMemo(() => getWidgetTitle(metricQueries), [metricQueries]);

  const {
    data: timeseriesData,
    isLoading,
    isError,
    error,
  } = useMetricsQuery(metricQueries, selection, {
    intervalLadder: widget.displayType === DisplayType.BAR ? 'bar' : 'dashboard',
  });

  const vizualizationComponent = useMemo(() => {
    if (widget.displayType === DisplayType.TABLE) {
      return (
        <MetricTableContainer
          metricQueries={metricQueries}
          timeseriesData={timeseriesData}
          isLoading={isLoading}
        />
      );
    }
    if (widget.displayType === DisplayType.BIG_NUMBER) {
      return (
        <MetricBigNumberContainer
          timeseriesData={timeseriesData}
          isLoading={isLoading}
          metricQueries={metricQueries}
        />
      );
    }

    return (
      <MetricChartContainer
        timeseriesData={timeseriesData}
        isLoading={isLoading}
        metricQueries={metricQueries}
        displayType={toMetricDisplayType(widget.displayType)}
        chartHeight={!showContextMenu ? 200 : undefined}
      />
    );
  }, [widget.displayType, metricQueries, timeseriesData, isLoading, showContextMenu]);

  return (
    <DashboardsMEPContext.Provider
      value={{
        isMetricsData: undefined,
        setIsMetricsData: () => {},
      }}
    >
      <WidgetCardPanel isDragging={false}>
        <WidgetHeaderWrapper>
          <WidgetHeaderDescription>
            <WidgetTitleRow>
              <WidgetTitle>
                <TextOverflow>{widget.title || widgetMQL}</TextOverflow>
              </WidgetTitle>
            </WidgetTitleRow>
          </WidgetHeaderDescription>

          <ContextMenuWrapper>
            {showContextMenu && !isEditingDashboard && (
              <WidgetCardContextMenu
                organization={organization}
                widget={widget}
                selection={selection}
                showContextMenu
                isPreview={false}
                widgetLimitReached={false}
                onEdit={() => {
                  router.push({
                    pathname: `${location.pathname}${
                      location.pathname.endsWith('/') ? '' : '/'
                    }widget/${widget.id}/`,
                    query: location.query,
                  });
                }}
                router={router}
                location={location}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
              />
            )}
          </ContextMenuWrapper>
        </WidgetHeaderWrapper>
        <ErrorBoundary>
          <WidgetCardBody
            isError={isError}
            timeseriesData={timeseriesData}
            renderErrorMessage={renderErrorMessage}
            error={error}
          >
            {vizualizationComponent}
          </WidgetCardBody>
        </ErrorBoundary>
        {isEditingDashboard && <Toolbar onDelete={onDelete} onDuplicate={onDuplicate} />}
      </WidgetCardPanel>
    </DashboardsMEPContext.Provider>
  );
}

function WidgetCardBody({children, isError, timeseriesData, renderErrorMessage, error}) {
  if (isError && !timeseriesData) {
    const errorMessage =
      error?.responseJSON?.detail?.toString() || t('Error while fetching metrics data');
    return (
      <ErrorWrapper>
        {renderErrorMessage?.(errorMessage)}
        <ErrorPanel>
          <IconWarning color="gray500" size="lg" />
        </ErrorPanel>
      </ErrorWrapper>
    );
  }

  return children;
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

const ErrorWrapper = styled('div')`
  padding-top: ${space(1)};
`;
