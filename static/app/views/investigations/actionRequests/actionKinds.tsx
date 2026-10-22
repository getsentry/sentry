import type {ComponentType} from 'react';

import {MonitorChanges} from 'sentry/views/investigations/actionRequests/monitorChanges';
import {getSourceMonitor} from 'sentry/views/investigations/source';
import type {
  InvestigationAction,
  InvestigationActionRequest,
  InvestigationDetail,
} from 'sentry/views/investigations/types';

type ActionKindProps = {
  actionRequest: InvestigationActionRequest;
  source?: InvestigationDetail['source'];
};

type ActionKind = {
  Details: ComponentType<ActionKindProps>;
};

function UpdateDetectorDetails({actionRequest, source}: ActionKindProps) {
  const {action} = actionRequest;
  if (action?.kind !== 'update_detector') {
    return null;
  }
  return (
    <MonitorChanges
      action={action}
      impact={actionRequest.impact}
      monitor={getSourceMonitor(source, action.detectorId)}
    />
  );
}

const ACTION_KINDS: Partial<Record<InvestigationAction['kind'], ActionKind>> = {
  update_detector: {Details: UpdateDetectorDetails},
};

export function getActionKind(action: InvestigationAction | null) {
  return action ? ACTION_KINDS[action.kind] : undefined;
}
