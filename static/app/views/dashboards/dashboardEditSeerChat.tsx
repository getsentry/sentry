import {useCallback, useRef} from 'react';

import {useOrganization} from 'sentry/utils/useOrganization';

import {DashboardChatPanel, type WidgetError} from './dashboardChatPanel';
import type {DashboardDetails, Widget} from './types';
import {useSeerDashboardSession} from './useSeerDashboardSession';

interface DashboardEditSeerChatProps {
  dashboard: DashboardDetails;
  onDashboardUpdate: (dashboard: Pick<DashboardDetails, 'title' | 'widgets'>) => void;
}

export function DashboardEditSeerChat({
  dashboard,
  onDashboardUpdate,
}: DashboardEditSeerChatProps) {
  const organization = useOrganization();
  const widgetErrorsMap = useRef(new Map<string, WidgetError>());

  const hasFeature =
    organization.features.includes('dashboards-edit') &&
    organization.features.includes('dashboards-ai-generate');

  const handleDashboardUpdate = useCallback(
    (data: {title: string; widgets: Widget[]}) => {
      widgetErrorsMap.current.clear();
      onDashboardUpdate({title: data.title, widgets: data.widgets});
    },
    [onDashboardUpdate]
  );

  const {session, isUpdating, isError, sendFollowUpMessage} = useSeerDashboardSession({
    dashboard: {title: dashboard.title, widgets: dashboard.widgets},
    onDashboardUpdate: handleDashboardUpdate,
    enabled: hasFeature,
  });

  if (!hasFeature) {
    return null;
  }

  const widgetErrors: WidgetError[] = dashboard.widgets.flatMap(widget => {
    if (widget.tempId === undefined) {
      return [];
    }
    const error = widgetErrorsMap.current.get(widget.tempId);
    return error ? [error] : [];
  });

  return (
    <DashboardChatPanel
      blocks={session?.blocks ?? []}
      pendingUserInput={session?.pending_user_input}
      onSend={sendFollowUpMessage}
      isUpdating={isUpdating}
      isError={isError}
      widgetErrors={widgetErrors}
    />
  );
}
