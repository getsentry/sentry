import {useCallback, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Alert} from '@sentry/scraps/alert';
import {Flex} from '@sentry/scraps/layout';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SeerExplorerResponse} from 'sentry/views/seerExplorer/hooks/useSeerExplorer';
import {makeSeerExplorerQueryKey} from 'sentry/views/seerExplorer/utils';

import {WidgetErrorProvider} from './contexts/widgetErrorContext';
import {EMPTY_DASHBOARD} from './data';
import DashboardDetail from './detail';
import {assignDefaultLayout, assignTempId, getInitialColumnDepths} from './layoutUtils';
import type {DashboardDetails, Widget} from './types';
import {DashboardState} from './types';
import {cloneDashboard} from './utils';

const POLL_INTERVAL_MS = 500;

type DashboardArtifact = {
  title: string;
  widgets: WidgetArtifact[];
};

type WidgetArtifact = {
  display_type: Widget['displayType'];
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
    interval: '',
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
  for (const block of session.blocks) {
    for (const artifact of block.artifacts ?? []) {
      if (artifact.key === 'dashboard' && artifact.data) {
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
  }
  return null;
}

function extractMessages(
  session: NonNullable<SeerExplorerResponse['session']>
): string[] {
  const messages: string[] = [];
  for (const block of session.blocks ?? []) {
    if (block.message?.content) {
      messages.push(block.message.content);
    }
  }
  return messages;
}

export default function CreateFromSeer() {
  const organization = useOrganization();
  const location = useLocation();

  const seerRunId = location.query?.seerRunId ? Number(location.query.seerRunId) : null;
  const hasFeature =
    organization.features.includes('dashboards-edit') &&
    organization.features.includes('dashboards-ai-generate');

  const {data, isError} = useApiQuery<SeerExplorerResponse>(
    makeSeerExplorerQueryKey(organization.slug, seerRunId),
    {
      staleTime: 0,
      retry: false,
      enabled: !!seerRunId && hasFeature,
      refetchInterval: query => {
        const status = query.state.data?.[0]?.session?.status;
        if (status === 'completed' || status === 'error') {
          return false;
        }
        return POLL_INTERVAL_MS;
      },
    }
  );

  const session = data?.session ?? null;
  const sessionStatus = session?.status ?? null;

  const blockMessages = useMemo(
    () => (session ? extractMessages(session) : []),
    [session]
  );

  const dashboard = useMemo<DashboardDetails>(() => {
    const baseDashboard = cloneDashboard(EMPTY_DASHBOARD);
    if (sessionStatus !== 'completed' || !session) {
      return baseDashboard;
    }
    const dashboardData = extractDashboardFromSession(session);
    if (!dashboardData) {
      return baseDashboard;
    }
    return {
      ...baseDashboard,
      title: dashboardData.title,
      widgets: dashboardData.widgets,
    };
  }, [session, sessionStatus]);

  const isLoading =
    !!seerRunId && sessionStatus !== 'completed' && sessionStatus !== 'error' && !isError;

  // Prevent repeat errors on the same widget
  const reportedWidgetErrors = useRef(new Set<string>());

  const handleWidgetError = useCallback(
    (widget: Widget, errorMessage: string) => {
      const errorKey = `${widget.title}:${errorMessage}`;
      if (reportedWidgetErrors.current.has(errorKey)) {
        return;
      }
      reportedWidgetErrors.current.add(errorKey);

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

  if (isLoading) {
    return (
      <Layout.Page withPadding>
        <Flex direction="column" gap="lg" align="center">
          <LoadingIndicator>{t('Generating dashboard...')}</LoadingIndicator>
          {blockMessages.length > 0 && (
            <Flex direction="column" gap="sm" maxWidth="600px">
              {blockMessages.map((message, index) => (
                <MessageBlock key={index} text={message} />
              ))}
            </Flex>
          )}
        </Flex>
      </Layout.Page>
    );
  }

  return (
    <ErrorBoundary>
      <WidgetErrorProvider value={handleWidgetError}>
        <DashboardDetail
          initialState={DashboardState.PREVIEW}
          dashboard={dashboard}
          dashboards={[]}
        />
      </WidgetErrorProvider>
    </ErrorBoundary>
  );
}

const MessageBlock = styled(MarkedText)`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  background: ${p => p.theme.tokens.background.secondary};
  border-radius: ${p => p.theme.radius.md};
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};

  p {
    margin-bottom: 0;
  }
`;
