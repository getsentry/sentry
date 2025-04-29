import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {SlowSSRWidget} from 'sentry/views/insights/pages/platform/nextjs/slowSsrWidget';
import {WebVitalsWidget} from 'sentry/views/insights/pages/platform/nextjs/webVitalsWidget';
import {DurationWidget} from 'sentry/views/insights/pages/platform/shared/durationWidget';
import {IssuesWidget} from 'sentry/views/insights/pages/platform/shared/issuesWidget';
import {PlatformLandingPageLayout} from 'sentry/views/insights/pages/platform/shared/layout';
import PagesTable from 'sentry/views/insights/pages/platform/shared/pagesTable';
import {PathsTable} from 'sentry/views/insights/pages/platform/shared/pathsTable';
import {TrafficWidget} from 'sentry/views/insights/pages/platform/shared/trafficWidget';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';

type View = 'api' | 'pages';
type SpanOperation = 'pageload' | 'navigation';

function PlaceholderWidget() {
  return <Widget Title={<Widget.WidgetTitle title="Placeholder Widget" />} />;
}

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
  const [activeView, setActiveView] = useState<View>('api');
  const [spanOperationFilter, setSpanOperationFilter] =
    useState<SpanOperation>('pageload');

  useEffect(() => {
    trackAnalytics('nextjs-insights.page-view', {
      organization,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {query, setTransactionFilter} = useTransactionNameQuery();

  const spanOperationOptions: Array<SelectOption<SpanOperation>> = [
    {value: 'pageload', label: t('Pageloads')},
    {value: 'navigation', label: t('Navigations')},
  ];

  return (
    <PlatformLandingPageLayout performanceType={performanceType}>
      <WidgetGrid>
        <RequestsContainer>
          <TrafficWidget
            title={t('Traffic')}
            trafficSeriesName={t('Page views')}
            baseQuery={'span.op:[navigation,pageload]'}
            query={query}
            releases={releases}
          />
        </RequestsContainer>
        <IssuesContainer>
          <IssuesWidget query={query} />
        </IssuesContainer>
        <DurationContainer>
          <DurationWidget query={query} releases={releases} />
        </DurationContainer>
        <WebVitalsContainer>
          <WebVitalsWidget query={query} />
        </WebVitalsContainer>
        <QueriesContainer>
          <SlowSSRWidget query={query} releases={releases} />
        </QueriesContainer>
        <CachesContainer>
          <PlaceholderWidget />
        </CachesContainer>
      </WidgetGrid>
      <ControlsWrapper>
        <SegmentedControl
          value={activeView}
          onChange={value => setActiveView(value)}
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
              setSpanOperationFilter(option.value)
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

      {activeView === 'pages' && <PagesTable spanOperationFilter={spanOperationFilter} />}
    </PlatformLandingPageLayout>
  );
}

const WidgetGrid = styled('div')`
  display: grid;
  gap: ${space(2)};
  padding-bottom: ${space(2)};

  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: 180px 180px 300px 240px 300px 300px;
  grid-template-areas:
    'requests'
    'duration'
    'issues'
    'web-vitals'
    'queries'
    'caches';

  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: 180px 300px 240px 300px;
    grid-template-areas:
      'requests duration'
      'issues issues'
      'web-vitals web-vitals'
      'queries caches';
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: 180px 180px 300px;
    grid-template-areas:
      'requests issues issues'
      'duration issues issues'
      'web-vitals queries caches';
  }
`;

const RequestsContainer = styled('div')`
  grid-area: requests;
`;

// TODO(aknaus): Remove css hacks and build custom IssuesWidget
const IssuesContainer = styled('div')`
  grid-area: issues;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
  & > * {
    min-width: 0;
    overflow-y: auto;
    margin-bottom: 0 !important;
  }
`;

const DurationContainer = styled('div')`
  grid-area: duration;
`;

const WebVitalsContainer = styled('div')`
  grid-area: web-vitals;
`;

const QueriesContainer = styled('div')`
  grid-area: queries;
`;

const CachesContainer = styled('div')`
  grid-area: caches;
`;

const ControlsWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${space(1)};
  margin: ${space(2)} 0;
`;
