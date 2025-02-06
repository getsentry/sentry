import {useEffect, useState} from 'react';
import isEqual from 'lodash/isEqual';

import NotFound from 'sentry/components/errors/notFound';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {WithRouteAnalyticsProps} from 'sentry/utils/routeAnalytics/withRouteAnalytics';
import withRouteAnalytics from 'sentry/utils/routeAnalytics/withRouteAnalytics';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {assignTempId} from './layoutUtils';
import type {DashboardDetails, DashboardListItem} from './types';
import {hasSavedPageFilters} from './utils';

type OrgDashboardsChildrenProps = {
  dashboard: DashboardDetails | null;
  dashboards: DashboardListItem[];
  error: boolean;
  onDashboardUpdate: (updatedDashboard: DashboardDetails) => void;
};

type Props = WithRouteAnalyticsProps & {
  children: (props: OrgDashboardsChildrenProps) => React.ReactNode;
};

function OrgDashboards(props: Props) {
  const {children} = props;
  const location = useLocation();
  const organization = useOrganization();
  const navigate = useNavigate();
  const {dashboardId} = useParams<{dashboardId: string}>();

  const ENDPOINT = `/organizations/${organization.slug}/dashboards/`;

  // The currently selected dashboard
  const [selectedDashboardState, setSelectedDashboardState] =
    useState<DashboardDetails | null>(null);

  const {
    data: dashboards,
    isPending: isDashboardsPending,
    isError: isDashboardsError,
    error: dashboardsError,
  } = useApiQuery<DashboardListItem[]>([ENDPOINT], {staleTime: 0, retry: false});

  const {
    data: fetchedSelectedDashboard,
    isLoading: isSelectedDashboardLoading,
    isError: isSelectedDashboardError,
    error: selectedDashboardError,
  } = useApiQuery<DashboardDetails>([`${ENDPOINT}${dashboardId}/`], {
    staleTime: 0,
    enabled: !!dashboardId,
    retry: false,
  });

  const selectedDashboard = selectedDashboardState ?? fetchedSelectedDashboard;

  useEffect(() => {
    if (dashboardId && !isEqual(dashboardId, selectedDashboard?.id)) {
      setSelectedDashboardState(null);
    }
  }, [dashboardId, selectedDashboard]);

  // If we don't have a selected dashboard, and one isn't going to arrive
  // we can redirect to the first dashboard in the list.
  useEffect(() => {
    if (!dashboardId) {
      const firstDashboardId = dashboards?.length
        ? dashboards[0]?.id
        : 'default-overview';
      navigate(
        normalizeUrl({
          pathname: `/organizations/${organization.slug}/dashboard/${firstDashboardId}/`,
          query: {
            ...location.query,
          },
        }),
        {replace: true}
      );
    }
  }, [dashboards, dashboardId, organization.slug, location.query, navigate]);

  useEffect(() => {
    if (dashboardId || selectedDashboard) {
      const queryParamFilters = new Set([
        'project',
        'environment',
        'statsPeriod',
        'start',
        'end',
        'utc',
        'release',
      ]);
      if (
        selectedDashboard &&
        // Only redirect if there are saved filters and none of the filters
        // appear in the query params
        hasSavedPageFilters(selectedDashboard) &&
        Object.keys(location.query).filter(unsavedQueryParam =>
          queryParamFilters.has(unsavedQueryParam)
        ).length === 0
      ) {
        navigate(
          {
            ...location,
            query: {
              ...location.query,
              project: selectedDashboard.projects,
              environment: selectedDashboard.environment,
              statsPeriod: selectedDashboard.period,
              start: selectedDashboard.start,
              end: selectedDashboard.end,
              utc: selectedDashboard.utc,
            },
          },
          {replace: true}
        );
      }
    }
  }, [dashboardId, location, navigate, selectedDashboard]);

  useEffect(() => {
    if (!organization.features.includes('dashboards-basic')) {
      // Redirect to Dashboards v1
      navigate(
        normalizeUrl({
          pathname: `/organizations/${organization.slug}/dashboards/`,
          query: {
            ...location.query,
          },
        }),
        {replace: true}
      );
    }
  }, [location.query, navigate, organization]);

  if (isDashboardsPending || isSelectedDashboardLoading) {
    return (
      <Layout.Page withPadding>
        <LoadingIndicator />
      </Layout.Page>
    );
  }

  if (
    (isDashboardsPending || isSelectedDashboardLoading) &&
    selectedDashboard &&
    hasSavedPageFilters(selectedDashboard) &&
    Object.keys(location.query).length === 0
  ) {
    // Block dashboard from rendering if the dashboard has filters and
    // the URL does not contain filters yet. The filters can either match the
    // saved filters, or can be different (i.e. sharing an unsaved state)
    return (
      <Layout.Page withPadding>
        <LoadingIndicator />
      </Layout.Page>
    );
  }

  if (isDashboardsError || isSelectedDashboardError) {
    const notFound =
      dashboardsError?.status === 404 || selectedDashboardError?.status === 404;

    if (notFound) {
      return <NotFound />;
    }

    return <LoadingError />;
  }

  const getDashboards = (): DashboardListItem[] => {
    return Array.isArray(dashboards) ? dashboards : [];
  };

  const renderContent = () => {
    // Ensure there are always tempIds for grid layout
    // This is needed because there are cases where the dashboard
    // renders before the onRequestSuccess setState is processed
    // and will caused stacked widgets because of missing tempIds
    const dashboard = selectedDashboard
      ? {
          ...selectedDashboard,
          widgets: selectedDashboard.widgets.map(assignTempId),
        }
      : null;

    return children({
      error: Boolean(dashboardsError || selectedDashboardError),
      dashboard,
      dashboards: getDashboards(),
      onDashboardUpdate: setSelectedDashboardState,
    });
  };

  return (
    <SentryDocumentTitle title={t('Dashboards')} orgSlug={organization.slug}>
      {renderContent()}
    </SentryDocumentTitle>
  );
}

export default withRouteAnalytics(OrgDashboards);
