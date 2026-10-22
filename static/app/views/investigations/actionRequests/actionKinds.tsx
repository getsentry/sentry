import type {ComponentType} from 'react';

import {MonitorChanges} from 'sentry/views/investigations/actionRequests/monitorChanges';
import type {
  InvestigationAction,
  InvestigationActionRequest,
} from 'sentry/views/investigations/types';

type ActionKindProps = {
  actionRequest: InvestigationActionRequest;
};

type ActionKind = {
  Details: ComponentType<ActionKindProps>;
};

function UpdateDetectorDetails({actionRequest}: ActionKindProps) {
  const {action} = actionRequest;
  if (action?.kind !== 'update_detector') {
    return null;
  }
  return <MonitorChanges action={action} impact={actionRequest.impact} />;
}

const ACTION_KINDS: Partial<Record<InvestigationAction['kind'], ActionKind>> = {
  update_detector: {Details: UpdateDetectorDetails},
};

export function getActionKind(action: InvestigationAction | null) {
  return action ? ACTION_KINDS[action.kind] : undefined;
}
