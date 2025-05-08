import {useEffect} from 'react';
import styled from '@emotion/styled';

import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {DeadRageClicksWidget} from 'sentry/views/insights/pages/platform/nextjs/deadRageClickWidget';
import SSRTreeWidget from 'sentry/views/insights/pages/platform/nextjs/ssrTreeWidget';
import {WebVitalsWidget} from 'sentry/views/insights/pages/platform/nextjs/webVitalsWidget';
import {DurationWidget} from 'sentry/views/insights/pages/platform/shared/durationWidget';
import {IssuesWidget} from 'sentry/views/insights/pages/platform/shared/issuesWidget';
import {PlatformLandingPageLayout} from 'sentry/views/insights/pages/platform/shared/layout';
import {PagesTable} from 'sentry/views/insights/pages/platform/shared/pagesTable';
import {PathsTable} from 'sentry/views/insights/pages/platform/shared/pathsTable';
import {WidgetGrid} from 'sentry/views/insights/pages/platform/shared/styles';
import {TrafficWidget} from 'sentry/views/insights/pages/platform/shared/trafficWidget';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';

type View = 'api' | 'pages';
type SpanOperation = 'pageload' | 'navigation';

// Define cursor parameter names based on span operation
const CURSOR_PARAM_NAMES: Record<SpanOperation, string> = {
  pageload: 'pageCursor',
  navigation: 'navCursor',
};
const spanOperationOptions: Array<SelectOption<SpanOperation>> = [
  {value: 'pageload', label: t('Pageloads')},
  {value: 'navigation', label: t('Navigations')},
];

export function NextJsOverviewPage({
  performanceType,
}: {
  performanceType: 'backend' | 'frontend';
}) {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const {releases: releasesWithDate} = useReleaseStats(pageFilters.selection);
  const releases =
    releasesWithDate?.map(({date, version}) => ({
      timestamp: date,
      version,
    })) ?? [];
  const location = useLocation();
  const navigate = useNavigate();

  const activeView: View = (location.query.view as View) ?? 'api';
  const spanOperationFilter: SpanOperation =
    (location.query.spanOp as SpanOperation) ?? 'pageload';

  const updateQuery = (newParams: Record<string, string>) => {
    const newQuery = {
      ...location.query,
      ...newParams,
    };
    if ('spanOp' in newParams && newParams.spanOp !== spanOperationFilter) {
      const oldCursorParamName = CURSOR_PARAM_NAMES[spanOperationFilter];
      delete newQuery[oldCursorParamName];
    }

    navigate(
      {
        pathname: location.pathname,
        query: newQuery,
      },
      {replace: true}
    );
  };

  useEffect(() => {
    trackAnalytics('nextjs-insights.page-view', {
      organization,
      view: activeView,
      spanOp: spanOperationFilter,
    });
  }, [organization, activeView, spanOperationFilter]);

  const {query, setTransactionFilter} = useTransactionNameQuery();

  return (
    <PlatformLandingPageLayout performanceType={performanceType}>
      <WidgetGrid>
        <WidgetGrid.Position1>
          <TrafficWidget
            title={t('Traffic')}
            trafficSeriesName={t('Page views')}
            baseQuery={'span.op:[navigation,pageload]'}
            query={query}
            releases={releases}
          />
        </WidgetGrid.Position1>
        <WidgetGrid.Position2>
          <DurationWidget query={query} releases={releases} />
        </WidgetGrid.Position2>
        <WidgetGrid.Position3>
          <IssuesWidget query={query} />
        </WidgetGrid.Position3>
        <WidgetGrid.Position4>
          <WebVitalsWidget query={query} />
        </WidgetGrid.Position4>
        <WidgetGrid.Position5>
          <DeadRageClicksWidget query={query} releases={releases} />
        </WidgetGrid.Position5>
        <WidgetGrid.Position6>
          <SSRTreeWidget />
        </WidgetGrid.Position6>
      </WidgetGrid>
      <ControlsWrapper>
        <SegmentedControl
          value={activeView}
          onChange={value => updateQuery({view: value})}
          size="sm"
        >
          <SegmentedControl.Item key="api">{t('API')}</SegmentedControl.Item>
          <SegmentedControl.Item key="pages">{t('Pages')}</SegmentedControl.Item>
        </SegmentedControl>
        {activeView === 'pages' && (
          <CompactSelect<SpanOperation>
            size="sm"
            triggerProps={{prefix: t('Display')}}
            options={spanOperationOptions}
            value={spanOperationFilter}
            onChange={(option: SelectOption<SpanOperation>) =>
              updateQuery({spanOp: option.value})
            }
          />
        )}
      </ControlsWrapper>

      {activeView === 'api' && (
        <PathsTable
          handleAddTransactionFilter={setTransactionFilter}
          query={query}
          showHttpMethodColumn={false}
          showUsersColumn={false}
        />
      )}

      {activeView === 'pages' && (
        <PagesTable
          spanOperationFilter={spanOperationFilter}
          handleAddTransactionFilter={setTransactionFilter}
          query={query}
        />
      )}
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
