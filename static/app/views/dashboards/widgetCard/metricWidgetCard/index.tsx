import {useMemo} from 'react';
import type {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {HeaderTitle} from 'sentry/components/charts/styles';
import TextOverflow from 'sentry/components/textOverflow';
import {space} from 'sentry/styles/space';
import type {Organization, PageFilters} from 'sentry/types';
import {getWidgetTitle} from 'sentry/utils/metrics';
import {WidgetCardPanel, WidgetTitleRow} from 'sentry/views/dashboards/widgetCard';
import {DashboardsMEPContext} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import {MetricWidgetChartContainer} from 'sentry/views/dashboards/widgetCard/metricWidgetCard/chart';
import {MetricWidgetTableContainer} from 'sentry/views/dashboards/widgetCard/metricWidgetCard/table';
import {Toolbar} from 'sentry/views/dashboards/widgetCard/toolbar';
import WidgetCardContextMenu from 'sentry/views/dashboards/widgetCard/widgetCardContextMenu';

import {convertToMetricWidget} from '../../../../utils/metrics/dashboard';
import type {DashboardFilters, Widget} from '../../types';

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
  const metricWidgetQueries = useMemo(() => convertToMetricWidget(widget), [widget]);

  const extendedQueries = useMemo(
    () =>
      metricWidgetQueries.map(query => ({
        ...query,
        query: extendQuery(query.query, dashboardFilters),
      })),
    [metricWidgetQueries, dashboardFilters]
  );

  const widgetMQL = useMemo(
    () => getWidgetTitle(metricWidgetQueries),
    [metricWidgetQueries]
  );

  const isTable = true;

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
        {!isTable ? (
          <MetricWidgetChartContainer
            metricWidgetQueries={extendedQueries}
            selection={selection}
            widget={widget}
            renderErrorMessage={renderErrorMessage}
            chartHeight={!showContextMenu ? 200 : undefined}
          />
        ) : (
          <MetricWidgetTableContainer
            metricWidgetQueries={extendedQueries}
            selection={selection}
            widget={widget}
            renderErrorMessage={renderErrorMessage}
          />
        )}
        {isEditingDashboard && <Toolbar onDelete={onDelete} onDuplicate={onDuplicate} />}
      </WidgetCardPanel>
    </DashboardsMEPContext.Provider>
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
