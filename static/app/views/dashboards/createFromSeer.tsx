import {useCallback, useEffect, useRef, useState} from 'react';

import {Alert} from '@sentry/scraps/alert';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import Feature from 'sentry/components/acl/feature';
import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useTimeseriesVisualizationEnabled} from 'sentry/views/dashboards/utils/useTimeseriesVisualizationEnabled';

import {EMPTY_DASHBOARD} from './data';
import DashboardDetail from './detail';
import {assignDefaultLayout, assignTempId, getInitialColumnDepths} from './layoutUtils';
import type {DashboardDetails, Widget} from './types';
import {DashboardState} from './types';
import {cloneDashboard} from './utils';

const POLL_INTERVAL_MS = 2000;

function normalizeWidget(raw: any): Widget {
  const {display_type, widget_type, ...rest} = raw;
  return {
    ...rest,
    displayType: display_type ?? raw.displayType,
    widgetType: widget_type ?? raw.widgetType,
    layout: raw.layout
      ? {
          x: raw.layout.x,
          y: raw.layout.y,
          w: raw.layout.w,
          h: raw.layout.h,
          minH: raw.layout.min_h,
        }
      : undefined,
  };
}

function extractDashboardFromSession(session: any): {
  title: string;
  widgets: Widget[];
} | null {
  for (const block of session.blocks) {
    for (const artifact of block.artifacts ?? []) {
      if (artifact.key === 'dashboard' && artifact.data) {
        return {
          title: artifact.data.title,
          widgets: assignDefaultLayout(
            artifact.data.widgets.map(normalizeWidget).map(assignTempId),
            getInitialColumnDepths()
          ),
        };
      }
    }
  }
  return null;
}

export default function CreateFromSeer() {
  const organization = useOrganization();
  const location = useLocation();
  const api = useApi();

  const useTimeseriesVisualization = useTimeseriesVisualizationEnabled();

  const seerRunId = location.query?.seerRunId as string | undefined;
  const baseDashboard = cloneDashboard(EMPTY_DASHBOARD);

  const [isLoading, setIsLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardDetails>(baseDashboard);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pollForResult = useCallback(
    async (runId: string) => {
      try {
        const response = await api.requestPromise(
          `/organizations/${organization.slug}/seer/explorer-chat/${runId}/`
        );

        const session = response.session;
        if (!session) {
          throw new Error('No session in response');
        }

        if (session.status === 'completed') {
          const dashboardData = extractDashboardFromSession(session);
          if (!dashboardData) {
            throw new Error('No dashboard artifact found in completed run');
          }

          setDashboard({
            ...baseDashboard,
            title: dashboardData.title,
            widgets: dashboardData.widgets,
          });
          setIsLoading(false);
        } else if (session.status === 'error') {
          throw new Error('Seer run failed');
        } else {
          pollTimerRef.current = setTimeout(() => pollForResult(runId), POLL_INTERVAL_MS);
        }
      } catch (_error) {
        setIsLoading(false);
        addErrorMessage(t('Failed to generate dashboard'));
      }
    },
    [api, organization.slug, baseDashboard]
  );

  useEffect(() => {
    if (seerRunId) {
      pollForResult(seerRunId);
    } else {
      setIsLoading(false);
    }

    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function renderDisabled() {
    return (
      <Layout.Page withPadding>
        <Alert.Container>
          <Alert variant="warning" showIcon={false}>
            {t("You don't have access to this feature")}
          </Alert>
        </Alert.Container>
      </Layout.Page>
    );
  }

  if (isLoading) {
    return (
      <Layout.Page withPadding>
        <LoadingIndicator>{t('Generating dashboard...')}</LoadingIndicator>
      </Layout.Page>
    );
  }

  return (
    <Feature
      features="dashboards-edit"
      organization={organization}
      renderDisabled={renderDisabled}
    >
      <ErrorBoundary>
        <DashboardDetail
          initialState={DashboardState.PREVIEW}
          dashboard={dashboard}
          dashboards={[]}
          useTimeseriesVisualization={useTimeseriesVisualization}
        />
      </ErrorBoundary>
    </Feature>
  );
}
