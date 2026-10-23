import {Text} from '@sentry/scraps/text';

import {MonitorChanges} from 'sentry/views/investigations/actionRequests/monitorChanges';
import {getSourceMonitor} from 'sentry/views/investigations/source';
import type {
  InvestigationActionRequest,
  InvestigationDetail,
} from 'sentry/views/investigations/types';

type ActionRequestDetailsProps = {
  actionRequest: InvestigationActionRequest;
  source?: InvestigationDetail['source'];
};

export function ActionRequestDetails({actionRequest, source}: ActionRequestDetailsProps) {
  const {action, impact} = actionRequest;

  switch (action?.kind) {
    case 'update_detector':
      return (
        <MonitorChanges
          action={action}
          impact={impact}
          monitor={getSourceMonitor(source, action.detectorId)}
        />
      );
    default:
      return impact ? (
        <Text as="p" size="md" density="comfortable">
          {impact}
        </Text>
      ) : null;
  }
}
