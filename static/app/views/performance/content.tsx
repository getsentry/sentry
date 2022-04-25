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
import {PageFilters} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {PerformanceEventViewProvider} from 'sentry/utils/performance/contexts/performanceEventViewContext';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';
import useProjects from 'sentry/utils/useProjects';
import withPageFilters from 'sentry/utils/withPageFilters';

import {DEFAULT_STATS_PERIOD, generatePerformanceEventView} from './data';
import {PerformanceLanding} from './landing';
import {addRoutePerformanceContext, handleTrendsClick} from './utils';

type Props = {
  location: Location;
  router: InjectedRouter;
  selection: PageFilters;
  demoMode?: boolean;
};

type State = {
  error?: string;
};

function PerformanceContent({selection, location, demoMode}: Props) {
  const api = useApi();
  const organization = useOrganization();
  const {projects} = useProjects();
  const mounted = useRef(false);
  const previousDateTime = usePrevious(selection.datetime);

  const [state, setState] = useState<State>({error: undefined});

  useEffect(() => {
    if (!mounted.current) {
      trackAdvancedAnalyticsEvent('performance_views.overview.view', {
        organization,
        show_onboarding: shouldShowOnboarding(),
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
  }, [selection.datetime]);

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
    trackAdvancedAnalyticsEvent('performance_views.overview.search', {organization});

    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        query: String(searchQuery).trim() || undefined,
        isDefaultQuery: false,
      },
    });
  }

  const eventView = generatePerformanceEventView(location, projects);

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

  return (
    <SentryDocumentTitle title={t('Performance')} orgSlug={organization.slug}>
      <PerformanceEventViewProvider value={{eventView}}>
        <MEPSettingProvider>
          <PageFiltersContainer
            defaultSelection={{
              datetime: {
                start: null,
                end: null,
                utc: false,
                period: DEFAULT_STATS_PERIOD,
              },
            }}
            hideGlobalHeader={organization.features.includes('selection-filters-v2')}
          >
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
          </PageFiltersContainer>
        </MEPSettingProvider>
      </PerformanceEventViewProvider>
    </SentryDocumentTitle>
  );
}

export default withPageFilters(PerformanceContent);
