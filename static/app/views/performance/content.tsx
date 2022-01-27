import {useEffect, useState} from 'react';
import {browserHistory, InjectedRouter} from 'react-router';
import * as Sentry from '@sentry/react';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import GlobalSdkUpdateAlert from 'sentry/components/globalSdkUpdateAlert';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import PageHeading from 'sentry/components/pageHeading';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {IconFlag} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PageContent, PageHeader} from 'sentry/styles/organization';
import {PageFilters} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import {PerformanceEventViewProvider} from 'sentry/utils/performance/contexts/performanceEventViewContext';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';
import useProjects from 'sentry/utils/useProjects';
import withPageFilters from 'sentry/utils/withPageFilters';

import LandingContent from './landing/content';
import {DEFAULT_STATS_PERIOD, generatePerformanceEventView} from './data';
import {PerformanceLanding} from './landing';
import {useMetricsSwitch} from './metricsSwitch';
import Onboarding from './onboarding';
import {addRoutePerformanceContext, handleTrendsClick} from './utils';

type Props = {
  selection: PageFilters;
  location: Location;
  router: InjectedRouter;
  demoMode?: boolean;
};

type State = {
  error?: string;
};

function PerformanceContent({selection, location, demoMode}: Props) {
  const api = useApi();
  const organization = useOrganization();
  const {projects} = useProjects();
  const {isMetricsData} = useMetricsSwitch();
  const previousDateTime = usePrevious(selection.datetime);

  const [state, setState] = useState<State>({error: undefined});

  useEffect(() => {
    loadOrganizationTags(api, organization.slug, selection);
    addRoutePerformanceContext(selection);
    trackAnalyticsEvent({
      eventKey: 'performance_views.overview.view',
      eventName: 'Performance Views: Transaction overview view',
      organization_id: parseInt(organization.id, 10),
      show_onboarding: shouldShowOnboarding(),
    });
  }, []);

  useEffect(() => {
    loadOrganizationTags(api, organization.slug, selection);
    addRoutePerformanceContext(selection);
  }, [selection.projects]);

  useEffect(() => {
    if (!isEqual(previousDateTime, selection.datetime)) {
      loadOrganizationTags(api, organization.slug, selection);
      addRoutePerformanceContext(selection);
    }
  }, [selection.datetime]);

  const {error} = state;

  function setError(newError?: string) {
    if (
      typeof newError === 'object' ||
      (Array.isArray(newError) && typeof newError[0] === 'object')
    ) {
      Sentry.withScope(scope => {
        scope.setExtra('error', newError);
        Sentry.captureException(new Error('setError failed with error type.'));
      });
      return;
    }
    setState({...state, error: newError});
  }

  function handleSearch(searchQuery: string) {
    trackAnalyticsEvent({
      eventKey: 'performance_views.overview.search',
      eventName: 'Performance Views: Transaction overview search',
      organization_id: parseInt(organization.id, 10),
    });

    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        query: String(searchQuery).trim() || undefined,
      },
    });
  }

  function renderError() {
    if (!error) {
      return null;
    }

    return (
      <Alert type="error" icon={<IconFlag size="md" />}>
        {error}
      </Alert>
    );
  }

  const eventView = generatePerformanceEventView(location, organization, projects, {
    isMetricsData,
  });

  function shouldShowOnboarding() {
    // XXX used by getsentry to bypass onboarding for the upsell demo state.
    if (demoMode) {
      return false;
    }

    if (projects.length === 0) {
      return false;
    }

    // Current selection is 'my projects' or 'all projects'
    if (eventView.project.length === 0 || eventView.project === [ALL_ACCESS_PROJECTS]) {
      return (
        projects.filter(p => p.firstTransactionEvent === false).length === projects.length
      );
    }

    // Any other subset of projects.
    return (
      projects.filter(
        p =>
          eventView.project.includes(parseInt(p.id, 10)) &&
          p.firstTransactionEvent === false
      ).length === eventView.project.length
    );
  }

  function renderBody() {
    const showOnboarding = shouldShowOnboarding();

    return (
      <PageContent>
        <NoProjectMessage organization={organization}>
          <PageHeader>
            <PageHeading>{t('Performance')}</PageHeading>
            {!showOnboarding && (
              <Button
                priority="primary"
                data-test-id="landing-header-trends"
                onClick={() => handleTrendsClick({location, organization})}
              >
                {t('View Trends')}
              </Button>
            )}
          </PageHeader>
          <GlobalSdkUpdateAlert />
          {renderError()}
          {showOnboarding ? (
            <Onboarding
              organization={organization}
              project={
                selection.projects.length > 0
                  ? // If some projects selected, use the first selection
                    projects.find(
                      project => selection.projects[0].toString() === project.id
                    ) || projects[0]
                  : // Otherwise, use the first project in the org
                    projects[0]
              }
            />
          ) : (
            <LandingContent
              eventView={eventView}
              projects={projects}
              organization={organization}
              setError={setError}
              handleSearch={handleSearch}
            />
          )}
        </NoProjectMessage>
      </PageContent>
    );
  }

  function renderLandingV3() {
    return (
      <PerformanceLanding
        eventView={eventView}
        setError={setError}
        handleSearch={handleSearch}
        handleTrendsClick={() => handleTrendsClick({location, organization})}
        shouldShowOnboarding={shouldShowOnboarding()}
        organization={organization}
        location={location}
        projects={projects}
        selection={selection}
      />
    );
  }

  return (
    <SentryDocumentTitle title={t('Performance')} orgSlug={organization.slug}>
      <PerformanceEventViewProvider value={{eventView}}>
        <PageFiltersContainer
          defaultSelection={{
            datetime: {
              start: null,
              end: null,
              utc: false,
              period: DEFAULT_STATS_PERIOD,
            },
          }}
        >
          <Feature features={['organizations:performance-landing-widgets']}>
            {({hasFeature}) => (hasFeature ? renderLandingV3() : renderBody())}
          </Feature>
        </PageFiltersContainer>
      </PerformanceEventViewProvider>
    </SentryDocumentTitle>
  );
}

export default withPageFilters(PerformanceContent);
