import {useCallback} from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';

import {Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {decodeScalar} from 'sentry/utils/queryString';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import {getSelectedProjectPlatforms} from '../../utils';
import {anomaliesRouteWithQuery} from '../transactionAnomalies/utils';
import {eventsRouteWithQuery} from '../transactionEvents/utils';
import {profilesRouteWithQuery} from '../transactionProfiles/utils';
import {replaysRouteWithQuery} from '../transactionReplays/utils';
import {spansRouteWithQuery} from '../transactionSpans/utils';
import {tagsRouteWithQuery} from '../transactionTags/utils';
import {vitalsRouteWithQuery} from '../transactionVitals/utils';
import {transactionSummaryRouteWithQuery} from '../utils';

import Tab from './tabs';

type TabEvents =
  | 'performance_views.vitals.vitals_tab_clicked'
  | 'performance_views.tags.tags_tab_clicked'
  | 'performance_views.events.events_tab_clicked'
  | 'performance_views.spans.spans_tab_clicked'
  | 'performance_views.anomalies.anomalies_tab_clicked';

const TAB_ANALYTICS: Partial<Record<Tab, TabEvents>> = {
  [Tab.WebVitals]: 'performance_views.vitals.vitals_tab_clicked',
  [Tab.Tags]: 'performance_views.tags.tags_tab_clicked',
  [Tab.Events]: 'performance_views.events.events_tab_clicked',
  [Tab.Spans]: 'performance_views.spans.spans_tab_clicked',
  [Tab.Anomalies]: 'performance_views.anomalies.anomalies_tab_clicked',
};

type Opts = {
  location: Location;
  organization: Organization;
  projectId: undefined | string;
  projects: Project[];
  tab: Tab;
  transactionName: undefined | string;
};

function usePageTabs({
  location,
  organization,
  projectId,
  projects,
  tab,
  transactionName,
}: Opts) {
  const getNewRoute = useCallback(
    (newTab: Tab) => {
      if (!transactionName) {
        return {};
      }

      const routeQuery = {
        orgSlug: organization.slug,
        transaction: transactionName,
        projectID: projectId,
        query: location.query,
      };

      switch (newTab) {
        case Tab.Tags:
          return tagsRouteWithQuery(routeQuery);
        case Tab.Events:
          return eventsRouteWithQuery(routeQuery);
        case Tab.Spans:
          return spansRouteWithQuery(routeQuery);
        case Tab.Anomalies:
          return anomaliesRouteWithQuery(routeQuery);
        case Tab.Replays:
          return replaysRouteWithQuery(routeQuery);
        case Tab.Profiling: {
          return profilesRouteWithQuery(routeQuery);
        }
        case Tab.WebVitals:
          return vitalsRouteWithQuery({
            orgSlug: organization.slug,
            transaction: transactionName,
            projectID: decodeScalar(location.query.project),
            query: location.query,
          });
        case Tab.TransactionSummary:
        default:
          return transactionSummaryRouteWithQuery(routeQuery);
      }
    },
    [location.query, organization.slug, projectId, transactionName]
  );

  const onTabChange = useCallback(
    (newTab: Tab) => {
      // Prevent infinite rerenders
      if (newTab === tab) {
        return;
      }

      const analyticsKey = TAB_ANALYTICS[newTab];
      if (analyticsKey) {
        trackAdvancedAnalyticsEvent(analyticsKey, {
          organization,
          project_platforms: getSelectedProjectPlatforms(location, projects),
        });
      }

      browserHistory.push(normalizeUrl(getNewRoute(newTab)));
    },
    [getNewRoute, tab, organization, location, projects]
  );

  return {
    onTabChange,
  };
}

export default usePageTabs;
