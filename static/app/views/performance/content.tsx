import {useEffect, useState} from 'react';
import {browserHistory, InjectedRouter} from 'react-router';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {loadOrganizationTags} from 'app/actionCreators/tags';
import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import GlobalSdkUpdateAlert from 'app/components/globalSdkUpdateAlert';
import NoProjectMessage from 'app/components/noProjectMessage';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import PageHeading from 'app/components/pageHeading';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {IconFlag} from 'app/icons';
import {t} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
import {GlobalSelection} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import EventView from 'app/utils/discover/eventView';
import {PerformanceEventViewProvider} from 'app/utils/performance/contexts/performanceEventViewContext';
import useApi from 'app/utils/useApi';
import useOrganization from 'app/utils/useOrganization';
import usePrevious from 'app/utils/usePrevious';
import useProjects from 'app/utils/useProjects';
import withGlobalSelection from 'app/utils/withGlobalSelection';

import LandingContent from './landing/content';
import {DEFAULT_STATS_PERIOD, generatePerformanceEventView} from './data';
import {PerformanceLanding} from './landing';
import Onboarding from './onboarding';
import {addRoutePerformanceContext, handleTrendsClick} from './utils';

type Props = {
  selection: GlobalSelection;
  location: Location;
  router: InjectedRouter;
  demoMode?: boolean;
};

type State = {
  eventView: EventView;
  error?: string;
};

function PerformanceContent({selection, location, demoMode}: Props) {
  const api = useApi();
  const organization = useOrganization();
  const {projects} = useProjects();

  const prevDeeplyNestedSelectProjects = usePrevious(selection.projects);
  const prevDeeplyNestedSelectDateTime = usePrevious(selection.datetime);

  const [state, setState] = useState<State>({
    eventView: generatePerformanceEventView(organization, location, projects),
    error: undefined,
  });

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
    setState({
      ...state,
      eventView: generatePerformanceEventView(organization, location, projects),
    });
  }, [organization, location, projects]);

  useEffect(() => {
    if (
      !isEqual(prevDeeplyNestedSelectProjects, selection.projects) ||
      !isEqual(prevDeeplyNestedSelectDateTime, selection.datetime)
    ) {
      loadOrganizationTags(api, organization.slug, selection);
      addRoutePerformanceContext(selection);
    }
  }, [
    prevDeeplyNestedSelectProjects,
    selection.projects,
    prevDeeplyNestedSelectDateTime,
    selection.datetime,
  ]);

  const {eventView, error} = state;

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

  function setError(newError?: string) {
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
      />
    );
  }

  return (
    <SentryDocumentTitle title={t('Performance')} orgSlug={organization.slug}>
      <PerformanceEventViewProvider value={{eventView}}>
        <GlobalSelectionHeader
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
        </GlobalSelectionHeader>
      </PerformanceEventViewProvider>
    </SentryDocumentTitle>
  );
}

export default withGlobalSelection(PerformanceContent);
