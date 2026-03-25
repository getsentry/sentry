import {memo, useCallback, useEffect, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Alert} from '@sentry/scraps/alert';

import {validateDashboard} from 'sentry/actionCreators/dashboards';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {fetchMutation, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {CreateFromSeerLoading} from 'sentry/views/dashboards/createFromSeerLoading';
import {CreateFromSeerPrompt} from 'sentry/views/dashboards/createFromSeerPrompt';
import type {SeerExplorerResponse} from 'sentry/views/seerExplorer/hooks/useSeerExplorer';
import {makeSeerExplorerQueryKey} from 'sentry/views/seerExplorer/utils';

import {WidgetErrorProvider} from './contexts/widgetErrorContext';
import {DashboardChatPanel, type WidgetError} from './dashboardChatPanel';
import {EMPTY_DASHBOARD} from './data';
import {DashboardDetailWithInjectedProps as DashboardDetail} from './detail';
import {assignDefaultLayout, assignTempId, getInitialColumnDepths} from './layoutUtils';
import type {DashboardDetails, Widget} from './types';
import {DashboardState} from './types';

const POLL_INTERVAL_MS = 500;
const DASHBOARD_ARTIFACT_KEY = 'dashboard';
const POST_COMPLETE_POLL_MS = 5000;
const EMPTY_DASHBOARDS: never[] = [];

type DashboardArtifact = {
  title: string;
  widgets: WidgetArtifact[];
};

type WidgetArtifact = {
  display_type: Widget['displayType'];
  interval: string;
  layout: {h: number; min_h: number; w: number; x: number; y: number};
  queries: Widget['queries'];
  title: string;
  widget_type: Widget['widgetType'];
  description?: string;
  limit?: number;
};

function normalizeWidget(raw: WidgetArtifact): Widget {
  const {display_type, widget_type, ...rest} = raw;
  return {
    ...rest,
    displayType: display_type,
    widgetType: widget_type,
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

function extractDashboardFromSession(
  session: NonNullable<SeerExplorerResponse['session']>
): {
  title: string;
  widgets: Widget[];
} | null {
  // Newest dashboard artifacts appear closer to the end of the array
  for (let i = session.blocks.length - 1; i >= 0; i--) {
    const artifact = session.blocks[i]!.artifacts?.find(
      a => a.key === DASHBOARD_ARTIFACT_KEY && a.data
    );
    if (artifact) {
      const data = artifact.data as DashboardArtifact;
      return {
        title: data.title,
        widgets: assignDefaultLayout(
          data.widgets.map(normalizeWidget).map(assignTempId),
          getInitialColumnDepths()
        ),
      };
    }
  }
  return null;
}

async function validateDashboardAndRecordMetrics(
  organization: Organization,
  newDashboard: DashboardDetails,
  seerRunId: number | null
) {
  try {
    await validateDashboard(organization.slug, newDashboard);
    Sentry.metrics.count('dashboards.seer.validation', 1, {
      attributes: {
        status: 'success',
        organization_slug: organization.slug,
        ...(seerRunId ? {seer_run_id: seerRunId} : {}),
      },
    });
  } catch (error) {
    Sentry.metrics.count('dashboards.seer.validation', 1, {
      attributes: {
        status: 'failure',
        organization_slug: organization.slug,
        ...(seerRunId ? {seer_run_id: seerRunId} : {}),
      },
    });
    Sentry.captureException(error, {
      tags: {seer_run_id: seerRunId},
    });
  }
}

function statusIsTerminal(status?: string | null) {
  return status === 'completed' || status === 'error' || status === 'awaiting_user_input';
}

export default function CreateFromSeer() {
  const organization = useOrganization();
  const location = useLocation();
  const queryClient = useQueryClient();

  const seerRunId = location.query?.seerRunId ? Number(location.query.seerRunId) : null;
  const hasFeature =
    organization.features.includes('dashboards-edit') &&
    organization.features.includes('dashboards-ai-generate');

  const [dashboard, setDashboard] = useState<DashboardDetails>(EMPTY_DASHBOARD);
  const [isUpdating, setisUpdating] = useState(false); // State tracks if dashboard is being updated from user chat input
  const prevSessionStatusRef = useRef<{
    status: string | null;
    updated_at: string | null;
  }>({status: null, updated_at: null});

  // Timestamp of when we observe a "completed" status.
  // This is required to poll for POST_COMPLETE_POLL_MS
  // since backend hooks can resume runs in case of
  // validation errors.
  const completedAtRef = useRef<number | null>(null);

  // Additional guards to prevent duplicate metrics recording and on reload
  const hasValidatedRef = useRef(false);
  const hasSeenNonTerminalRef = useRef(false);

  const {data, isError} = useApiQuery<SeerExplorerResponse>(
    makeSeerExplorerQueryKey(organization.slug, seerRunId),
    {
      staleTime: 0,
      retry: false,
      enabled: !!seerRunId && hasFeature,
      refetchInterval: query => {
        const status = query.state.data?.[0]?.session?.status;
        if (statusIsTerminal(status)) {
          if (completedAtRef.current === null) {
            completedAtRef.current = Date.now();
          }
          if (Date.now() - completedAtRef.current < POST_COMPLETE_POLL_MS) {
            return POLL_INTERVAL_MS;
          }
          if (!hasValidatedRef.current && hasSeenNonTerminalRef.current) {
            hasValidatedRef.current = true;
            validateDashboardAndRecordMetrics(organization, dashboard, seerRunId);
          }
          return false;
        }
        if (status !== undefined && !statusIsTerminal(status)) {
          hasSeenNonTerminalRef.current = true;
          hasValidatedRef.current = false;
          completedAtRef.current = null;
        }
        return POLL_INTERVAL_MS;
      },
    }
  );

  const session = data?.session;
  const sessionStatus = session?.status ?? null;
  const sessionUpdatedAt = session?.updated_at ?? null;

  useEffect(() => {
    if (!session) {
      return;
    }
    const prevUpdatedAt = prevSessionStatusRef.current.updated_at;
    const prevStatus = prevSessionStatusRef.current.status;
    prevSessionStatusRef.current = {
      status: sessionStatus,
      updated_at: sessionUpdatedAt,
    };

    const isTerminal = statusIsTerminal(sessionStatus);
    const wasTerminal = statusIsTerminal(prevStatus);

    // Only trigger Dashboard rerender when transition to a new completed state
    if (prevUpdatedAt !== sessionUpdatedAt && isTerminal && !wasTerminal) {
      if (isUpdating) {
        setisUpdating(false);
      }
      const dashboardData = extractDashboardFromSession(session);
      if (dashboardData) {
        const newDashboard = {
          ...EMPTY_DASHBOARD,
          title: dashboardData.title,
          widgets: dashboardData.widgets,
        };
        setDashboard(newDashboard);
        reportedWidgetErrors.current.clear();
        setWidgetErrorsMap(new Map());
      }
    }
  }, [organization, seerRunId, isUpdating, sessionStatus, session, sessionUpdatedAt]);

  const isLoading = !statusIsTerminal(sessionStatus) && !isError;

  // Prevent repeat errors on the same widget
  const reportedWidgetErrors = useRef(new Set<string>());
  // Maps widget tempId to error message
  const [widgetErrorsMap, setWidgetErrorsMap] = useState(new Map<string, WidgetError>());

  const handleWidgetError = useCallback(
    (widget: Widget, errorMessage: string) => {
      const errorKey = `${widget.title}:${errorMessage}`;
      if (reportedWidgetErrors.current.has(errorKey)) {
        return;
      }
      reportedWidgetErrors.current.add(errorKey);
      if (widget.tempId !== undefined) {
        setWidgetErrorsMap(prev => {
          const next = new Map(prev);
          next.set(widget.tempId!, {
            widgetTitle: widget.title,
            errorMessage,
          });
          return next;
        });
      }

      Sentry.withScope(scope => {
        scope.setFingerprint(['generated-dashboard-widget-query-error']);
        scope.setTag('seer.run_id', seerRunId);
        scope.setLevel('error');
        Sentry.captureMessage('Generated dashboard widget query error', {
          extra: {
            widget_title: widget.title,
            error_message: errorMessage,
          },
        });
      });
    },
    [seerRunId]
  );

  useEffect(() => {
    if (sessionStatus === 'error' || isError) {
      addErrorMessage(t('Failed to generate dashboard'));
    }
  }, [sessionStatus, isError]);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!seerRunId) {
        return;
      }
      setisUpdating(true);
      completedAtRef.current = null;
      hasValidatedRef.current = false;
      reportedWidgetErrors.current.clear();
      setWidgetErrorsMap(new Map());
      try {
        const queryKey = makeSeerExplorerQueryKey(organization.slug, seerRunId);
        const {url} = parseQueryKey(queryKey);
        await fetchMutation({
          url,
          method: 'POST',
          data: {query: message},
        });
        queryClient.invalidateQueries({queryKey});
      } catch {
        setisUpdating(false);
        addErrorMessage(t('Failed to send message'));
      }
    },
    [organization.slug, queryClient, seerRunId]
  );

  if (!hasFeature) {
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

  if (!seerRunId) {
    return <CreateFromSeerPrompt />;
  }

  if (isLoading && !isUpdating) {
    return <CreateFromSeerLoading blocks={session?.blocks ?? []} seerRunId={seerRunId} />;
  }

  const widgetErrors: WidgetError[] = dashboard.widgets.flatMap(widget => {
    if (widget.tempId === undefined) {
      return [];
    }
    const error = widgetErrorsMap.get(widget.tempId);
    return error ? [error] : [];
  });

  return (
    <ErrorBoundary>
      <WidgetErrorProvider value={handleWidgetError}>
        <MemoizedDashboardDetail
          initialState={DashboardState.PREVIEW}
          dashboard={dashboard}
          dashboards={EMPTY_DASHBOARDS} // This prop is unused for the create from seer flow
        />
        <DashboardChatPanel
          blocks={session?.blocks ?? []}
          pendingUserInput={session?.pending_user_input}
          onSend={sendMessage}
          isUpdating={isUpdating}
          isError={sessionStatus === 'error'}
          widgetErrors={widgetErrors}
        />
      </WidgetErrorProvider>
    </ErrorBoundary>
  );
}

const MemoizedDashboardDetail = memo(DashboardDetail);
