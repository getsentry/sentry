import {useEffect} from 'react';
import styled from '@emotion/styled';

import PanelHeader from 'sentry/components/panels/panelHeader';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {BACKEND_LANDING_TITLE} from 'sentry/views/insights/pages/backend/settings';
import {CachesWidget} from 'sentry/views/insights/pages/platform/laravel/cachesWidget';
import {DurationWidget} from 'sentry/views/insights/pages/platform/laravel/durationWidget';
import {JobsWidget} from 'sentry/views/insights/pages/platform/laravel/jobsWidget';
import {PathsTable} from 'sentry/views/insights/pages/platform/laravel/pathsTable';
import {QueriesWidget} from 'sentry/views/insights/pages/platform/laravel/queriesWidget';
import {RequestsWidget} from 'sentry/views/insights/pages/platform/laravel/requestsWidget';
import {IssuesWidget} from 'sentry/views/insights/pages/platform/shared/issuesWidget';
import {PlatformLandingPageLayout} from 'sentry/views/insights/pages/platform/shared/layout';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';

export function LaravelOverviewPage() {
  const organization = useOrganization();

  useEffect(() => {
    trackAnalytics('laravel-insights.page-view', {
      organization,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {query, setTransactionFilter} = useTransactionNameQuery();

  return (
    <PlatformLandingPageLayout headerTitle={BACKEND_LANDING_TITLE}>
      <WidgetGrid>
        <RequestsContainer>
          <RequestsWidget query={query} />
        </RequestsContainer>
        <IssuesContainer>
          <IssuesWidget query={query} />
        </IssuesContainer>
        <DurationContainer>
          <DurationWidget query={query} />
        </DurationContainer>
        <JobsContainer>
          <JobsWidget query={query} />
        </JobsContainer>
        <QueriesContainer>
          <QueriesWidget query={query} />
        </QueriesContainer>
        <CachesContainer>
          <CachesWidget query={query} />
        </CachesContainer>
      </WidgetGrid>
      <PathsTable handleAddTransactionFilter={setTransactionFilter} query={query} />
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
    'jobs'
    'queries'
    'caches';

  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: 180px 300px 240px 300px;
    grid-template-areas:
      'requests duration'
      'issues issues'
      'jobs jobs'
      'queries caches';
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: 180px 180px 300px;
    grid-template-areas:
      'requests issues issues'
      'duration issues issues'
      'jobs queries caches';
  }
`;

const RequestsContainer = styled('div')`
  grid-area: requests;
  min-width: 0;
  & > * {
    height: 100% !important;
  }
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
  min-width: 0;
  & > * {
    height: 100% !important;
  }
`;

const JobsContainer = styled('div')`
  grid-area: jobs;
  min-width: 0;
  & > * {
    height: 100% !important;
  }
`;

const QueriesContainer = styled('div')`
  grid-area: queries;
`;

const CachesContainer = styled('div')`
  grid-area: caches;
`;
