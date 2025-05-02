import {useEffect} from 'react';
import styled from '@emotion/styled';

import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {PathsTable} from 'sentry/views/insights/pages/platform/laravel/pathsTable';
import {SlowSSRWidget} from 'sentry/views/insights/pages/platform/nextjs/slowSsrWidget';
import {WebVitalsWidget} from 'sentry/views/insights/pages/platform/nextjs/webVitalsWidget';
import {DurationWidget} from 'sentry/views/insights/pages/platform/shared/durationWidget';
import {IssuesWidget} from 'sentry/views/insights/pages/platform/shared/issuesWidget';
import {PlatformLandingPageLayout} from 'sentry/views/insights/pages/platform/shared/layout';
import {TrafficWidget} from 'sentry/views/insights/pages/platform/shared/trafficWidget';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';

function PlaceholderWidget() {
  return <Widget Title={<Widget.WidgetTitle title="Placeholder Widget" />} />;
}

export function NextJsOverviewPage({headerTitle}: {headerTitle: React.ReactNode}) {
  const organization = useOrganization();

  useEffect(() => {
    trackAnalytics('nextjs-insights.page-view', {
      organization,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {query, setTransactionFilter} = useTransactionNameQuery();

  return (
    <PlatformLandingPageLayout headerTitle={headerTitle}>
      <WidgetGrid>
        <RequestsContainer>
          <TrafficWidget
            title={t('Traffic')}
            trafficSeriesName={t('Page views')}
            baseQuery={'span.op:[navigation,pageload]'}
            query={query}
          />
        </RequestsContainer>
        <IssuesContainer>
          <IssuesWidget query={query} />
        </IssuesContainer>
        <DurationContainer>
          <DurationWidget query={query} />
        </DurationContainer>
        <WebVitalsContainer>
          <WebVitalsWidget query={query} />
        </WebVitalsContainer>
        <QueriesContainer>
          <SlowSSRWidget query={query} />
        </QueriesContainer>
        <CachesContainer>
          <PlaceholderWidget />
        </CachesContainer>
      </WidgetGrid>
      <PathsTable
        handleAddTransactionFilter={setTransactionFilter}
        query={query}
        showHttpMethodColumn={false}
        showUsersColumn={false}
      />
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

  & ${PanelHeader} {
    position: sticky;
    top: 0;
    z-index: ${p => p.theme.zIndex.header};
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
