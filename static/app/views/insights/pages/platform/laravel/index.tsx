import {useEffect} from 'react';
import styled from '@emotion/styled';

import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import OverviewApiLatencyChartWidget from 'sentry/views/insights/common/components/widgets/overviewApiLatencyChartWidget';
import OverviewCacheMissChartWidget from 'sentry/views/insights/common/components/widgets/overviewCacheMissChartWidget';
import OverviewJobsChartWidget from 'sentry/views/insights/common/components/widgets/overviewJobsChartWidget';
import OverviewRequestsChartWidget from 'sentry/views/insights/common/components/widgets/overviewRequestsChartWidget';
import OverviewSlowQueriesChartWidget from 'sentry/views/insights/common/components/widgets/overviewSlowQueriesChartWidget';
import {TableUrlParams} from 'sentry/views/insights/pages/agents/utils/urlParams';
import {CommandsTable} from 'sentry/views/insights/pages/platform/laravel/commandsTable';
import {JobsTable} from 'sentry/views/insights/pages/platform/laravel/jobsTable';
import {PathsTable} from 'sentry/views/insights/pages/platform/laravel/pathsTable';
import {IssuesWidget} from 'sentry/views/insights/pages/platform/shared/issuesWidget';
import {PlatformLandingPageLayout} from 'sentry/views/insights/pages/platform/shared/layout';
import {WidgetGrid} from 'sentry/views/insights/pages/platform/shared/styles';

enum TableType {
  PATHS = 'paths',
  COMMANDS = 'commands',
  QUEUES = 'queues',
}

function isTableType(value: any): value is TableType {
  return Object.values(TableType).includes(value as TableType);
}

const decodeTableType = (value: any): TableType => {
  if (isTableType(value)) {
    return value;
  }
  return TableType.PATHS;
};

const TableControl = SegmentedControl<TableType>;
const TableControlItem = SegmentedControl.Item<TableType>;

export function LaravelOverviewPage() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const currentView = decodeTableType(location.query.view);

  useEffect(() => {
    trackAnalytics('laravel-insights.page-view', {
      organization,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleViewChange(view: TableType) {
    trackAnalytics('laravel-insights.table_view_change', {
      organization,
      view,
    });

    navigate(
      {
        pathname: location.pathname,
        query: {
          ...location.query,
          // Reset cursors when view changes
          [TableUrlParams.CURSOR]: undefined,
          // Reset sort parameters when view changes
          [TableUrlParams.SORT_FIELD]: undefined,
          [TableUrlParams.SORT_ORDER]: undefined,
          view,
        },
      },
      {
        replace: true,
        preventScrollReset: true,
      }
    );
  }

  return (
    <PlatformLandingPageLayout>
      <WidgetGrid>
        <WidgetGrid.Position1>
          <OverviewRequestsChartWidget />
        </WidgetGrid.Position1>
        <WidgetGrid.Position2>
          <OverviewApiLatencyChartWidget />
        </WidgetGrid.Position2>
        <WidgetGrid.Position3>
          <IssuesWidget />
        </WidgetGrid.Position3>
        <WidgetGrid.Position4>
          <OverviewJobsChartWidget />
        </WidgetGrid.Position4>
        <WidgetGrid.Position5>
          <OverviewSlowQueriesChartWidget />
        </WidgetGrid.Position5>
        <WidgetGrid.Position6>
          <OverviewCacheMissChartWidget />
        </WidgetGrid.Position6>
      </WidgetGrid>
      <ControlsWrapper>
        <TableControl value={currentView} onChange={handleViewChange} size="sm">
          <TableControlItem key={TableType.PATHS}>{t('Paths')}</TableControlItem>
          <TableControlItem key={TableType.COMMANDS}>{t('Commands')}</TableControlItem>
          <TableControlItem key={TableType.QUEUES}>{t('Jobs')}</TableControlItem>
        </TableControl>
      </ControlsWrapper>
      {currentView === TableType.QUEUES && <JobsTable />}
      {currentView === TableType.PATHS && <PathsTable />}
      {currentView === TableType.COMMANDS && <CommandsTable />}
    </PlatformLandingPageLayout>
  );
}

const ControlsWrapper = styled('div')`
  padding: ${space(2)} 0;
`;
