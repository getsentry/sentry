import {t} from 'sentry/locale';
import {ActionRequestCard} from 'sentry/views/investigations/actionRequests/actionRequestCard';
import type {InvestigationActionRequest} from 'sentry/views/investigations/types';

export function NextStepCard({
  actionRequests,
}: {
  actionRequests: InvestigationActionRequest[] | undefined;
}) {
  const actionRequest = getPrimaryActionRequest(actionRequests ?? []);

  if (!actionRequest) {
    return null;
  }

  return (
    <ActionRequestCard actionRequest={actionRequest} heading={t('Recommended action')} />
  );
}

function getPrimaryActionRequest(actionRequests: InvestigationActionRequest[]) {
  const latestRevision = Math.max(
    ...actionRequests.map(actionRequest => actionRequest.reportRevision)
  );
  return actionRequests.find(
    actionRequest =>
      actionRequest.primary && actionRequest.reportRevision === latestRevision
  );
}
