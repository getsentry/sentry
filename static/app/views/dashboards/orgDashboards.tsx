import {useEffect, useMemo, useRef, useState} from 'react';
import isEqual from 'lodash/isEqual';

import NotFound from 'sentry/components/errors/notFound';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useGetPrebuiltDashboard} from 'sentry/views/dashboards/utils/usePopulateLinkedDashboards';

import {assignTempId} from './layoutUtils';
import type {DashboardDetails, DashboardListItem} from './types';
import {getCurrentPageFilters, hasSavedPageFilters} from './utils';

type OrgDashboardsChildrenProps = {
  dashboard: DashboardDetails | null;
  dashboards: DashboardListItem[];
  error: boolean;
  onDashboardUpdate: (updatedDashboard: DashboardDetails) => void;
};

interface OrgDashboardsProps {
  children: (props: OrgDashboardsChildrenProps) => React.ReactNode;
  /**
   * Initial dashboard state to use for optimistic updates.
   * This is used when navigating from widget builder to show the new widget immediately.
   */
  initialDashboard?: DashboardDetails;
}

function OrgDashboards({children, initialDashboard}: OrgDashboardsProps) {
  const location = useLocation();
  const organization = useOrganization();
  const navigate = useNavigate();
  const {dashboardId} = useParams<{dashboardId: string}>();
  const dashboardRedirectRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  const ENDPOINT = `/organizations/${organization.slug}/dashboards/`;

  // The currently selected dashboard. Use initialDashboard for optimistic updates
  // when navigating from widget builder (passed via location.state).
  const [selectedDashboardState, setSelectedDashboardState] =
    useState<DashboardDetails | null>(initialDashboard ?? null);

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

  let selectedDashboard = selectedDashboardState ?? fetchedSelectedDashboard;

  const {dashboard: prebuiltDashboard, isLoading: isPrebuiltDashboardLoading} =
    useGetPrebuiltDashboard(selectedDashboard?.prebuiltId);

  // If the dashboard is a prebuilt dashboard, merge the prebuilt dashboard data into the selected dashboard
  if (selectedDashboard?.prebuiltId) {
    selectedDashboard = {
      ...selectedDashboard,
      ...prebuiltDashboard,
    };
  }

  useEffect(() => {
    if (dashboardId && !isEqual(dashboardId, selectedDashboard?.id)) {
      setSelectedDashboardState(null);
    }
  }, [dashboardId, selectedDashboard?.id]);

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
    // Only redirect if there are saved filters and none of the filters
    // appear in the query params

    // current filters based on location
    const locationFilters = getCurrentPageFilters(location);
    if (
      !selectedDashboard ||
      !hasSavedPageFilters(selectedDashboard) ||
      // Apply redirect once for each dashboard id
      dashboardRedirectRef.current === selectedDashboard.id ||
      hasSavedPageFilters(locationFilters)
    ) {
      return;
    }

    dashboardRedirectRef.current = selectedDashboard.id;
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
  }, [location, navigate, selectedDashboard]);

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
  }, [location.query, navigate, organization.slug, organization.features]);

  useEffect(() => {
    // Clean up the query cache when the dashboard unmounts to prevent
    // a flicker from stale data on refetch
    return () => {
      queryClient.removeQueries({
        queryKey: [`${ENDPOINT}${dashboardId}/`],
      });
    };
  }, [dashboardId, ENDPOINT, queryClient]);

  const childrenProps = useMemo(
    () => ({
      error: Boolean(dashboardsError || selectedDashboardError),
      dashboard: selectedDashboard
        ? {
            ...selectedDashboard,
            widgets: selectedDashboard.widgets.map(assignTempId),
          }
        : null,
      dashboards: Array.isArray(dashboards) ? dashboards : [],
      onDashboardUpdate: setSelectedDashboardState,
    }),
    [dashboardsError, selectedDashboardError, selectedDashboard, dashboards]
  );

  if (isDashboardsPending || isSelectedDashboardLoading || isPrebuiltDashboardLoading) {
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

  return (
    <SentryDocumentTitle title={t('Dashboards')} orgSlug={organization.slug}>
      {children(childrenProps)}
    </SentryDocumentTitle>
  );
}

export default OrgDashboards;
