import {memo, useCallback, useEffect, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';

import {validateDashboard} from 'sentry/actionCreators/dashboards';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {CreateFromSeerLoading} from 'sentry/views/dashboards/createFromSeerLoading';
import {CreateFromSeerPrompt} from 'sentry/views/dashboards/createFromSeerPrompt';

import {WidgetErrorProvider} from './contexts/widgetErrorContext';
import {statusIsTerminal} from './createFromSeerUtils';
import {DashboardChatPanel, type WidgetError} from './dashboardChatPanel';
import {EMPTY_DASHBOARD} from './data';
import {DashboardDetailWithInjectedProps as DashboardDetail} from './detail';
import type {DashboardDetails, Widget} from './types';
import {DashboardState} from './types';
import {useSeerDashboardSession} from './useSeerDashboardSession';

const EMPTY_DASHBOARDS: never[] = [];

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

export default function CreateFromSeer() {
  const organization = useOrganization();
  const location = useLocation();

  const seerRunId = location.query?.seerRunId ? Number(location.query.seerRunId) : null;
  const hasFeature =
    organization.features.includes('dashboards-edit') &&
    organization.features.includes('dashboards-ai-generate');

  const [dashboard, setDashboard] = useState<DashboardDetails>(EMPTY_DASHBOARD);

  // Additional guards to prevent duplicate metrics recording and on reload
  const hasValidatedRef = useRef(false);
  const hasSeenNonTerminalRef = useRef(false);

  // Prevent repeat errors on the same widget
  const reportedWidgetErrors = useRef(new Set<string>());
  // Maps widget tempId to error message
  const widgetErrorsMap = useRef(new Map<string, WidgetError>());

  const handleDashboardUpdate = useCallback(
    (data: {title: string; widgets: Widget[]}) => {
      const newDashboard = {
        ...EMPTY_DASHBOARD,
        title: data.title,
        widgets: data.widgets,
      };
      setDashboard(newDashboard);
      reportedWidgetErrors.current.clear();
    },
    []
  );

  const handlePostCompletePollEnd = useCallback(() => {
    if (!hasValidatedRef.current && hasSeenNonTerminalRef.current) {
      hasValidatedRef.current = true;
      validateDashboardAndRecordMetrics(organization, dashboard, seerRunId);
    }
  }, [organization, dashboard, seerRunId]);

  const {session, isUpdating, setIsUpdating, isError, sendFollowUpMessage} =
    useSeerDashboardSession({
      seerRunId,
      onDashboardUpdate: handleDashboardUpdate,
      enabled: hasFeature,
      onPostCompletePollEnd: handlePostCompletePollEnd,
    });

  const sessionStatus = session?.status ?? null;

  useEffect(() => {
    if (sessionStatus !== null && !statusIsTerminal(sessionStatus)) {
      hasSeenNonTerminalRef.current = true;
      hasValidatedRef.current = false;
    }
  }, [sessionStatus]);

  const handleWidgetError = useCallback(
    (widget: Widget, errorMessage: string) => {
      const errorKey = `${widget.title}:${errorMessage}`;
      if (reportedWidgetErrors.current.has(errorKey)) {
        return;
      }
      reportedWidgetErrors.current.add(errorKey);
      if (widget.tempId !== undefined) {
        widgetErrorsMap.current.set(widget.tempId, {
          widgetTitle: widget.title,
          errorMessage,
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
      Sentry.metrics.count('dashboards.seer.generation.session.error', 1, {
        attributes: {
          organization_slug: organization.slug,
        },
      });
    }
  }, [sessionStatus, isError, organization.slug]);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!seerRunId) {
        return;
      }
      setIsUpdating(true);
      hasValidatedRef.current = false;
      reportedWidgetErrors.current.clear();
      await sendFollowUpMessage(message);
    },
    [seerRunId, setIsUpdating, sendFollowUpMessage]
  );

  if (!hasFeature) {
    return (
      <Stack flex={1} padding="2xl 3xl">
        <Alert.Container>
          <Alert variant="warning" showIcon={false}>
            {t("You don't have access to this feature")}
          </Alert>
        </Alert.Container>
      </Stack>
    );
  }

  if (!seerRunId) {
    return <CreateFromSeerPrompt />;
  }

  const isLoading = !statusIsTerminal(sessionStatus) && !isError;

  if (isLoading && !isUpdating) {
    return <CreateFromSeerLoading blocks={session?.blocks ?? []} seerRunId={seerRunId} />;
  }

  const widgetErrors: WidgetError[] = dashboard.widgets.flatMap(widget => {
    if (widget.tempId === undefined) {
      return [];
    }
    const error = widgetErrorsMap.current.get(widget.tempId);
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
