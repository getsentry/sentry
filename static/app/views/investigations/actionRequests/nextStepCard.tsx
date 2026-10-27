import {useId} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {
  ActionRequestCard,
  isStaleActionRequest,
} from 'sentry/views/investigations/actionRequests/actionRequestCard';
import {PlaceholderBar} from 'sentry/views/investigations/hypotheses/hypothesisPlaceholder';
import {isWritingMetadata} from 'sentry/views/investigations/statusBlock/getSeerStatusBlock';
import type {
  InvestigationActionRequest,
  InvestigationDetail,
  InvestigationOrchestration,
} from 'sentry/views/investigations/types';

type NextStepCardProps = {
  actionRequests: InvestigationActionRequest[] | undefined;
  investigationId: string;
  orchestration: InvestigationOrchestration | undefined;
  /** The action requests predate the run's current next step. */
  actionRequestsStale?: boolean;
  orchestrationLoading?: boolean;
  source?: InvestigationDetail['source'];
  waitingOnRun?: boolean;
};

export function NextStepCard({
  actionRequests,
  actionRequestsStale = false,
  investigationId,
  orchestration,
  orchestrationLoading = false,
  source,
  waitingOnRun = false,
}: NextStepCardProps) {
  const heading = t('Recommended action');

  if (orchestrationLoading) {
    return null;
  }

  const actionRequest = getPrimaryActionRequest(
    actionRequests ?? [],
    orchestration?.report.revision
  );

  if (actionRequest) {
    return (
      <ActionRequestCard
        actionRequest={actionRequest}
        finishing={orchestration?.report.nextStep?.status === 'generating'}
        heading={heading}
        investigationId={investigationId}
        runProcessing={isRunWorking(orchestration) || waitingOnRun}
        source={source}
      />
    );
  }

  if (isNextStepPending(orchestration, actionRequestsStale)) {
    return <NextStepPlaceholder heading={heading} />;
  }

  if (orchestration?.report.nextStep?.status === 'failed') {
    return <NextStepFailed heading={heading} />;
  }

  return null;
}

export function isRunWorking(orchestration: InvestigationOrchestration | undefined) {
  return orchestration?.status === 'pending' || orchestration?.status === 'processing';
}

export function getPrimaryActionRequest(
  actionRequests: InvestigationActionRequest[],
  reportRevision: number | undefined
) {
  const revision =
    reportRevision ??
    Math.max(...actionRequests.map(actionRequest => actionRequest.reportRevision));
  return actionRequests
    .filter(
      actionRequest =>
        actionRequest.primary &&
        actionRequest.reportRevision >= revision &&
        (actionRequest.state !== 'superseded' || isStaleActionRequest(actionRequest))
    )
    .toSorted(
      (a, b) =>
        Number(a.state === 'withdrawn') - Number(b.state === 'withdrawn') ||
        Number(b.id) - Number(a.id)
    )[0];
}

function isNextStepPending(
  orchestration: InvestigationOrchestration | undefined,
  actionRequestsStale: boolean
) {
  const status = orchestration?.report.nextStep?.status;
  if (status === 'generating' || (status === 'completed' && actionRequestsStale)) {
    return true;
  }
  return (
    orchestration !== undefined &&
    isWritingMetadata(orchestration) &&
    (status === 'not_started' || status === 'completed')
  );
}

function NextStepFailed({heading}: {heading: string}) {
  const headingId = useId();
  return (
    <Stack as="section" gap="md" aria-labelledby={headingId}>
      <Heading as="h2" size="lg" id={headingId}>
        {heading}
      </Heading>
      <Text as="p" size="md" density="comfortable" variant="muted">
        {t('Seer could not suggest a next step for this investigation.')}
      </Text>
    </Stack>
  );
}

function NextStepPlaceholder({heading}: {heading: string}) {
  const headingId = useId();
  return (
    <Stack as="section" gap="lg" aria-labelledby={headingId} aria-busy>
      <Heading as="h2" size="lg" id={headingId}>
        {heading}
      </Heading>
      <Stack gap="sm" aria-hidden>
        <PlaceholderBar height="12px" />
        <PlaceholderBar height="12px" width="65%" />
      </Stack>
    </Stack>
  );
}
