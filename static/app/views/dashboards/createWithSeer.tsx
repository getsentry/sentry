import {useEffect, useMemo, useRef, useState} from 'react';

import {Alert} from '@sentry/scraps/alert';

import Feature from 'sentry/components/acl/feature';
import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {uniqueId} from 'sentry/utils/guid';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {SeerExplorerResponse} from 'sentry/views/seerExplorer/hooks/useSeerExplorer';
import {openSeerExplorer} from 'sentry/views/seerExplorer/openSeerExplorer';
import type {Block} from 'sentry/views/seerExplorer/types';
import {makeSeerExplorerQueryKey} from 'sentry/views/seerExplorer/utils';

import {EMPTY_DASHBOARD} from './data';
import DashboardDetail from './detail';
import type {DashboardDetails, Widget, WidgetLayout} from './types';
import {DashboardState} from './types';
import {cloneDashboard} from './utils';

// Sent as the opening message to orient the agent toward dashboard creation.
const SEER_SYSTEM_PROMPT = 'Help me build a Sentry dashboard.';

interface DashboardToolCallParams {
  title: string;
  widgets: Array<{
    description: string;
    display_type: Widget['displayType'];
    layout: WidgetLayout;
    queries: Widget['queries'];
    title: string;
    widget_type: Widget['widgetType'];
  }>;
}

function getLatestDashboardToolCall(blocks: Block[]): DashboardToolCallParams | null {
  let latest: DashboardToolCallParams | null = null;

  for (const block of blocks) {
    for (const call of block.message.tool_calls ?? []) {
      if (call.function === 'DashboardValidationTool') {
        try {
          latest = JSON.parse(call.args);
        } catch {
          // ignore malformed args
        }
      }
    }
  }

  return latest;
}

function toolCallToDashboard(params: DashboardToolCallParams): DashboardDetails {
  const base = cloneDashboard(EMPTY_DASHBOARD);
  return {
    ...base,
    title: params.title,
    widgets: (params.widgets ?? []).map(w => ({
      tempId: uniqueId(),
      title: w.title,
      displayType: w.display_type,
      widgetType: w.widget_type,
      layout: w.layout,
      queries: (w.queries ?? []).map(q => ({
        name: q.name ?? '',
        aggregates: q.aggregates ?? [],
        columns: q.columns ?? [],
        conditions: q.conditions ?? '',
        orderby: q.orderby ?? '',
        fields: q.fields ?? [...(q.aggregates ?? []), ...(q.columns ?? [])],
      })),
    })) as Widget[],
  };
}

export default function CreateWithSeer() {
  const organization = useOrganization();
  const [runId, setRunId] = useState<number | null>(null);

  useEffect(() => {
    openSeerExplorer({
      startNewRun: true,
      initialMessage: SEER_SYSTEM_PROMPT,
      onRunCreated: setRunId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  const {data} = useApiQuery<SeerExplorerResponse>(
    makeSeerExplorerQueryKey(organization.slug, runId),
    {
      staleTime: 0,
      enabled: !!runId,
      refetchInterval: 500,
    }
  );

  const dashboardParams = useMemo(() => {
    const blocks = data?.session?.blocks ?? [];
    return getLatestDashboardToolCall(blocks);
  }, [data]);

  // Bump a version counter whenever the tool call params change to remount DashboardDetail
  // with fresh props. The class component doesn't sync modifiedDashboard from props,
  // so remounting is the cleanest way to reflect each iteration from the agent.
  const prevParamsRef = useRef(dashboardParams);
  const [dashboardVersion, setDashboardVersion] = useState(0);
  useEffect(() => {
    if (dashboardParams !== prevParamsRef.current) {
      prevParamsRef.current = dashboardParams;
      setDashboardVersion(v => v + 1);
    }
  }, [dashboardParams]);

  const dashboard = useMemo(
    () =>
      dashboardParams
        ? toolCallToDashboard(dashboardParams)
        : cloneDashboard(EMPTY_DASHBOARD),
    [dashboardParams]
  );

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

  return (
    <Feature
      features="dashboards-edit"
      organization={organization}
      renderDisabled={renderDisabled}
    >
      <ErrorBoundary>
        <DashboardDetail
          key={dashboardVersion}
          initialState={DashboardState.CREATE}
          dashboard={dashboard}
          dashboards={[]}
        />
      </ErrorBoundary>
    </Feature>
  );
}
