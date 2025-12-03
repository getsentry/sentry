import {useCallback, useEffect} from 'react';
import styled from '@emotion/styled';

import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {type DatePageFilterProps} from 'sentry/components/organizations/datePageFilter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import OverviewApiLatencyChartWidget from 'sentry/views/insights/common/components/widgets/overviewApiLatencyChartWidget';
import OverviewPageloadsChartWidget from 'sentry/views/insights/common/components/widgets/overviewPageloadsChartWidget';
import OverviewSlowNextjsSSRWidget from 'sentry/views/insights/common/components/widgets/overviewSlowNextjsSSRWidget';
import {ApiTable} from 'sentry/views/insights/pages/platform/nextjs/apiTable';
import {ClientTable} from 'sentry/views/insights/pages/platform/nextjs/clientTable';
import {DeadRageClicksWidget} from 'sentry/views/insights/pages/platform/nextjs/deadRageClickWidget';
import {ServerTree} from 'sentry/views/insights/pages/platform/nextjs/serverTree';
import {WebVitalsWidget} from 'sentry/views/insights/pages/platform/nextjs/webVitalsWidget';
import {IssuesWidget} from 'sentry/views/insights/pages/platform/shared/issuesWidget';
import {PlatformLandingPageLayout} from 'sentry/views/insights/pages/platform/shared/layout';
import {WidgetGrid} from 'sentry/views/insights/pages/platform/shared/styles';

enum TableType {
  API = 'api',
  SSR = 'ssr',
  CLIENT = 'client',
}

function isTableType(value: any): value is TableType {
  return Object.values(TableType).includes(value as TableType);
}

const TableControl = SegmentedControl<TableType>;
const TableControlItem = SegmentedControl.Item<TableType>;

interface NextJsOverviewPageProps {
  datePageFilterProps: DatePageFilterProps;
}

export function NextJsOverviewPage({datePageFilterProps}: NextJsOverviewPageProps) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const activeTable: TableType = isTableType(location.query.view)
    ? location.query.view
    : TableType.CLIENT;

  const updateQuery = useCallback(
    (newParams: Record<string, string | string[] | null | undefined>) => {
      const newQuery = {
        ...location.query,
        ...newParams,
      };

      navigate(
        {
          pathname: location.pathname,
          query: newQuery,
        },
        {replace: true, preventScrollReset: true}
      );
    },
    [location.query, location.pathname, navigate]
  );

  useEffect(() => {
    trackAnalytics('nextjs-insights.page-view', {
      organization,
      view: activeTable,
    });
  }, [organization, activeTable]);

  const handleTableViewChange = useCallback(
    (view: TableType) => {
      trackAnalytics('nextjs-insights.table_view_change', {
        organization,
        view,
      });
      updateQuery({
        view,
        // Clear table cursor and sort order
        tableCursor: undefined,
        field: undefined,
        order: undefined,
      });
    },
    [organization, updateQuery]
  );

  return (
    <PlatformLandingPageLayout datePageFilterProps={datePageFilterProps}>
      <WidgetGrid>
        <WidgetGrid.Position1>
          <OverviewPageloadsChartWidget />
        </WidgetGrid.Position1>
        <WidgetGrid.Position2>
          <OverviewApiLatencyChartWidget />
        </WidgetGrid.Position2>
        <WidgetGrid.Position3>
          <IssuesWidget />
        </WidgetGrid.Position3>
        <WidgetGrid.Position4>
          <WebVitalsWidget />
        </WidgetGrid.Position4>
        <WidgetGrid.Position5>
          <DeadRageClicksWidget />
        </WidgetGrid.Position5>
        <WidgetGrid.Position6>
          <OverviewSlowNextjsSSRWidget />
        </WidgetGrid.Position6>
      </WidgetGrid>
      <ControlsWrapper>
        <TableControl value={activeTable} onChange={handleTableViewChange} size="sm">
          <TableControlItem key={TableType.CLIENT}>{t('Client')}</TableControlItem>
          <TableControlItem key={TableType.API}>{t('API')}</TableControlItem>
          <TableControlItem key={TableType.SSR}>{t('SSR')}</TableControlItem>
        </TableControl>
      </ControlsWrapper>

      {activeTable === TableType.API && <ApiTable />}
      {activeTable === TableType.CLIENT && <ClientTable />}
      {activeTable === TableType.SSR && <ServerTree />}
    </PlatformLandingPageLayout>
  );
}

const ControlsWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${space(1)};
  margin: ${space(2)} 0;
`;
