import {Stack} from '@sentry/scraps/layout';

import {ActionRequestCard} from 'sentry/views/investigations/actionRequests/actionRequestCard';
import type {
  InvestigationActionRequest,
  InvestigationActionRequestAnchor,
  InvestigationDetail,
} from 'sentry/views/investigations/types';

type AnchoredActionRequestsProps = {
  actionRequests: InvestigationActionRequest[] | undefined;
  investigationId: string;
  getLabel?: (anchor: InvestigationActionRequestAnchor | null) => React.ReactNode;
  runProcessing?: boolean;
  source?: InvestigationDetail['source'];
};

export function AnchoredActionRequests({
  actionRequests = [],
  getLabel,
  investigationId,
  runProcessing,
  source,
}: AnchoredActionRequestsProps) {
  if (actionRequests.length === 0) {
    return null;
  }

  return (
    <Stack gap="xl">
      {actionRequests.map(actionRequest => (
        <ActionRequestCard
          key={actionRequest.id}
          actionRequest={actionRequest}
          investigationId={investigationId}
          label={getLabel?.(actionRequest.anchor)}
          runProcessing={runProcessing}
          source={source}
        />
      ))}
    </Stack>
  );
}

export function groupActionRequestsByPlacement(
  actionRequests: InvestigationActionRequest[],
  getPlacement: (anchor: InvestigationActionRequestAnchor | null) => string | null
) {
  const groups = new Map<string, InvestigationActionRequest[]>();
  for (const actionRequest of actionRequests) {
    const placement = actionRequest.primary ? null : getPlacement(actionRequest.anchor);
    if (placement !== null) {
      groups.set(placement, [...(groups.get(placement) ?? []), actionRequest]);
    }
  }
  return groups;
}
