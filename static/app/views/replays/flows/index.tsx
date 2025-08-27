import {Outlet} from 'react-router-dom';

import AnalyticsArea from 'sentry/components/analyticsArea';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import useOrganization from 'sentry/utils/useOrganization';

export default function ReplayFlowsContainer() {
  const organization = useOrganization();

  return (
    <AnalyticsArea name="replay.flows">
      <NoProjectMessage organization={organization}>
        <Outlet />
      </NoProjectMessage>
    </AnalyticsArea>
  );
}
