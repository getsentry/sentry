import {Stack} from '@sentry/scraps/layout';

import {
  ActionRequestCard,
  isCurrentActionRequest,
  isStaleActionRequest,
} from 'sentry/views/investigations/actionRequests/actionRequestCard';
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
  const shown = getShownActionRequests(actionRequests);
  if (shown.length === 0) {
    return null;
  }

  return (
    <Stack gap="xl">
      {shown.map(actionRequest => (
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

function getShownActionRequests(actionRequests: InvestigationActionRequest[]) {
  const groups = new Map<string, InvestigationActionRequest[]>();
  for (const actionRequest of actionRequests) {
    const group = getGroupKey(actionRequest);
    groups.set(group, [...(groups.get(group) ?? []), actionRequest]);
  }
  const shown = new Set([...groups.values()].flatMap(getShownInGroup));
  return actionRequests.filter(actionRequest => shown.has(actionRequest));
}

function getShownInGroup(group: InvestigationActionRequest[]) {
  const current = group.filter(isCurrentActionRequest);
  const shown = group.filter(
    actionRequest =>
      isCurrentActionRequest(actionRequest) ||
      (isStaleActionRequest(actionRequest) &&
        !current.some(newer => replaces(newer, actionRequest)))
  );
  if (shown.length > 0) {
    return shown;
  }
  const newestWithdrawn = group
    .filter(({state}) => state === 'withdrawn')
    .toSorted(byNewest)[0];
  return newestWithdrawn ? [newestWithdrawn] : [];
}

function replaces(newer: InvestigationActionRequest, stale: InvestigationActionRequest) {
  return (
    newer.reportRevision > stale.reportRevision ||
    (newer.key === stale.key && byNewest(newer, stale) < 0)
  );
}

function byNewest(a: InvestigationActionRequest, b: InvestigationActionRequest) {
  return (
    b.reportRevision - a.reportRevision ||
    Date.parse(b.dateCreated) - Date.parse(a.dateCreated)
  );
}

function getGroupKey({anchor, key}: InvestigationActionRequest) {
  return anchor ? `${anchor.type}:${anchor.id}` : `key:${key}`;
}
