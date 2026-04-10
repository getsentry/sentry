import {useCallback} from 'react';

import {useOrganization} from 'sentry/utils/useOrganization';

import {DashboardChatPanel} from './dashboardChatPanel';
import type {DashboardDetails, Widget} from './types';
import {useSeerDashboardSession} from './useSeerDashboardSession';

interface DashboardEditSeerChatProps {
  dashboard: DashboardDetails;
  onDashboardUpdate: (
    dashboard: Pick<DashboardDetails, 'title' | 'widgets'>,
    seerRunId: number | null
  ) => void;
}

export function DashboardEditSeerChat({
  dashboard,
  onDashboardUpdate,
}: DashboardEditSeerChatProps) {
  const organization = useOrganization();

  const hasFeature =
    organization.features.includes('dashboards-edit') &&
    organization.features.includes('dashboards-ai-generate');

  const handleDashboardUpdate = useCallback(
    (data: {title: string; widgets: Widget[]}, seerRunId: number | null) => {
      onDashboardUpdate({title: data.title, widgets: data.widgets}, seerRunId);
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

  return (
    <DashboardChatPanel
      blocks={session?.blocks ?? []}
      pendingUserInput={session?.pending_user_input}
      onSend={sendFollowUpMessage}
      isUpdating={isUpdating}
      isError={isError}
    />
  );
}
