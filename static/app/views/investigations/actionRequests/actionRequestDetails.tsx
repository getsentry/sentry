import {Text} from '@sentry/scraps/text';

import {MonitorChanges} from 'sentry/views/investigations/actionRequests/monitorChanges';
import type {InvestigationActionRequest} from 'sentry/views/investigations/types';

type ActionRequestDetailsProps = {
  actionRequest: InvestigationActionRequest;
};

export function ActionRequestDetails({actionRequest}: ActionRequestDetailsProps) {
  const {action, impact} = actionRequest;

  switch (action?.kind) {
    case 'update_detector':
      return <MonitorChanges action={action} impact={impact} />;
    default:
      return impact ? (
        <Text as="p" size="md" density="comfortable">
          {impact}
        </Text>
      ) : null;
  }
}
