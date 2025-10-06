import {useEffect, useMemo, useRef} from 'react';
import isEqual from 'lodash/isEqual';

import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {WebVital} from 'sentry/utils/fields';
import {PerformanceEventViewProvider} from 'sentry/utils/performance/contexts/performanceEventViewContext';
import {decodeScalar} from 'sentry/utils/queryString';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import withProjects from 'sentry/utils/withProjects';
import {generatePerformanceVitalDetailView} from 'sentry/views/performance/data';
import {
  addRoutePerformanceContext,
  getPerformanceBaseUrl,
  getSelectedProjectPlatforms,
  getTransactionName,
} from 'sentry/views/performance/utils';

import VitalDetailContent from './vitalDetailContent';

type Props = RouteComponentProps & {
  loadingProjects: boolean;
  organization: Organization;
  projects: Project[];
  selection: PageFilters;
};

function VitalDetail({organization, selection, location, projects, router}: Props) {
  const api = useApi();
  const navigate = useNavigate();

  useRouteAnalyticsEventNames(
    'performance_views.vital_detail.view',
    'Performance Views: Vital Detail viewed'
  );
  useRouteAnalyticsParams({
    project_platforms: getSelectedProjectPlatforms(location, projects),
  });

  const eventView = useMemo(
    () => generatePerformanceVitalDetailView(location),
    [location]
  );

  const documentTitle = useMemo(() => {
    const name = getTransactionName(location);
    const hasTransactionName = typeof name === 'string' && String(name).trim().length > 0;
    if (hasTransactionName) {
      return [String(name).trim(), t('Performance')].join(' — ');
    }
    return [t('Vital Detail'), t('Performance')].join(' — ');
  }, [location]);

  const prevSelectionRef = useRef<PageFilters | null>(null);
  useEffect(() => {
    const prev = prevSelectionRef.current;
    if (
      !prev ||
      !isEqual(prev.projects, selection.projects) ||
      !isEqual(prev.datetime, selection.datetime)
    ) {
      loadOrganizationTags(api, organization.slug, selection);
      addRoutePerformanceContext(selection);
    }
    prevSelectionRef.current = selection;
  }, [api, organization.slug, selection]);

  if (!eventView) {
    navigate(
      normalizeUrl({
        pathname: getPerformanceBaseUrl(organization.slug),
        query: {
          ...location.query,
        },
      }),
      {replace: true}
    );
    return null;
  }

  const vitalNameQuery = decodeScalar(location.query.vitalName);
  const vitalName = Object.values(WebVital).includes(vitalNameQuery as WebVital)
    ? (vitalNameQuery as WebVital)
    : undefined;

  return (
    <SentryDocumentTitle title={documentTitle} orgSlug={organization.slug}>
      <PerformanceEventViewProvider value={{eventView}}>
        <PageFiltersContainer>
          <Layout.Page>
            <VitalDetailContent
              location={location}
              organization={organization}
              eventView={eventView}
              router={router}
              vitalName={vitalName || WebVital.LCP}
              api={api}
            />
          </Layout.Page>
        </PageFiltersContainer>
      </PerformanceEventViewProvider>
    </SentryDocumentTitle>
  );
}

export default withPageFilters(withProjects(withOrganization(VitalDetail)));
