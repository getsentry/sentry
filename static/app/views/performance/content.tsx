import {useEffect, useRef, useState} from 'react';
import {browserHistory, InjectedRouter} from 'react-router';
import * as Sentry from '@sentry/react';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {PageFilters, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {
  canUseMetricsData,
  MEPState,
  METRIC_SEARCH_SETTING_PARAM,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {PerformanceEventViewProvider} from 'sentry/utils/performance/contexts/performanceEventViewContext';
import useDisableRouteAnalytics from 'sentry/utils/routeAnalytics/useDisableRouteAnalytics';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';
import useProjects from 'sentry/utils/useProjects';
import withPageFilters from 'sentry/utils/withPageFilters';

import {DEFAULT_STATS_PERIOD, generatePerformanceEventView} from './data';
import {PerformanceLanding} from './landing';
import {
  addRoutePerformanceContext,
  getSelectedProjectPlatforms,
  handleTrendsClick,
} from './utils';

type Props = {
  location: Location;
  router: InjectedRouter;
  selection: PageFilters;
  demoMode?: boolean;
};

type State = {
  error?: string;
};

function PerformanceContent({selection, location, demoMode, router}: Props) {
  const api = useApi();
  const organization = useOrganization();
  const {projects} = useProjects();
  const mounted = useRef(false);
  const previousDateTime = usePrevious(selection.datetime);
  // TODO: remove the trackAdvancedAnalyticsEvent call and use useRouteAnalyticsParams instead
  useDisableRouteAnalytics();

  const [state, setState] = useState<State>({error: undefined});
  const withStaticFilters = canUseMetricsData(organization);
  const eventView = generatePerformanceEventView(location, projects, {
    withStaticFilters,
  });

  function getOnboardingProject(): Project | undefined {
    // XXX used by getsentry to bypass onboarding for the upsell demo state.
    if (demoMode) {
      return undefined;
    }

    if (projects.length === 0) {
      return undefined;
    }

    // Current selection is 'my projects' or 'all projects'
    if (eventView.project.length === 0 || eventView.project[0] === ALL_ACCESS_PROJECTS) {
      const filtered = projects.filter(p => p.firstTransactionEvent === false);
      if (filtered.length === projects.length) {
        return filtered[0];
      }
    }

    // Any other subset of projects.
    const filtered = projects.filter(
      p =>
        eventView.project.includes(parseInt(p.id, 10)) &&
        p.firstTransactionEvent === false
    );
    if (filtered.length === eventView.project.length) {
      return filtered[0];
    }

    return undefined;
  }

  const onboardingProject = getOnboardingProject();

  useEffect(() => {
    if (!mounted.current) {
      const selectedProjects = getSelectedProjectPlatforms(location, projects);

      trackAdvancedAnalyticsEvent('performance_views.overview.view', {
        organization,
        show_onboarding: onboardingProject !== undefined,
        project_platforms: selectedProjects,
      });

      loadOrganizationTags(api, organization.slug, selection);
      addRoutePerformanceContext(selection);
      mounted.current = true;
      return;
    }
    if (!isEqual(previousDateTime, selection.datetime)) {
      loadOrganizationTags(api, organization.slug, selection);
      addRoutePerformanceContext(selection);
    }
  }, [
    selection.datetime,
    previousDateTime,
    selection,
    api,
    organization,
    onboardingProject,
    location,
    projects,
  ]);

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

  function handleSearch(searchQuery: string, currentMEPState?: MEPState) {
    trackAdvancedAnalyticsEvent('performance_views.overview.search', {organization});

    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        query: String(searchQuery).trim() || undefined,
        [METRIC_SEARCH_SETTING_PARAM]: currentMEPState,
        isDefaultQuery: false,
      },
    });
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
          <PerformanceLanding
            router={router}
            eventView={eventView}
            setError={setError}
            handleSearch={handleSearch}
            handleTrendsClick={() =>
              handleTrendsClick({
                location,
                organization,
                projectPlatforms: getSelectedProjectPlatforms(location, projects),
              })
            }
            onboardingProject={onboardingProject}
            organization={organization}
            location={location}
            projects={projects}
            selection={selection}
            withStaticFilters={withStaticFilters}
          />
        </PageFiltersContainer>
      </PerformanceEventViewProvider>
    </SentryDocumentTitle>
  );
}

export default withPageFilters(PerformanceContent);
