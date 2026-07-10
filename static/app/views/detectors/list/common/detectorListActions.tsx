import {Flex} from '@sentry/scraps/layout';

import {AlertsMonitorsShowcaseButton} from 'sentry/components/workflowEngine/alertsMonitorsShowcaseButton';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';

interface DetectorListActionsProps {
  children?: React.ReactNode;
}

export function DetectorListActions({children}: DetectorListActionsProps) {
  return (
    <Flex gap="sm">
      <AlertsMonitorsShowcaseButton />
      {children}
      <MonitorFeedbackButton />
    </Flex>
  );
}
