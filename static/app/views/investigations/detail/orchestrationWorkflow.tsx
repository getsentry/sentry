import {useEffect, useState} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Badge} from '@sentry/scraps/badge';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {
  InvestigationHypothesis,
  InvestigationHypothesisStatus,
  InvestigationOrchestration,
  InvestigationOrchestrationError,
  InvestigationOrchestrationEvidence,
  InvestigationOrchestrationStatus,
  InvestigationOrchestrationWorkStatus,
  InvestigationVerificationStep,
} from 'sentry/views/investigations/types';

const STALE_AFTER_MS = 2 * 60 * 1000;

type Props = {
  orchestration: InvestigationOrchestration;
  now?: number;
};

export function InvestigationOrchestrationWorkflow({orchestration, now}: Props) {
  const [, setStaleCheck] = useState(0);
  const currentTime = now ?? Date.now();
  const hypotheses = orchestration.hypotheses.toSorted(
    (left, right) => left.order - right.order
  );
  const stale = isInvestigationOrchestrationStale(orchestration, currentTime);
  const terminal = isOrchestrationTerminal(orchestration.status);
  const hasSupportedHypothesis = hypotheses.some(hypothesis =>
    ['supported', 'accepted'].includes(hypothesis.effectiveStatus)
  );
  const hasOnlyRejectedOrInconclusiveHypotheses =
    hypotheses.length > 0 &&
    hypotheses.every(hypothesis =>
      ['refuted', 'rejected', 'inconclusive'].includes(hypothesis.effectiveStatus)
    );

  useEffect(() => {
    if (
      now !== undefined ||
      isOrchestrationTerminal(orchestration.status) ||
      !orchestration.heartbeatAt
    ) {
      return;
    }
    const heartbeat = Date.parse(orchestration.heartbeatAt);
    if (!Number.isFinite(heartbeat)) {
      return;
    }
    const timeout = window.setTimeout(
      () => setStaleCheck(value => value + 1),
      Math.max(heartbeat + STALE_AFTER_MS - Date.now(), 0)
    );
    return () => window.clearTimeout(timeout);
  }, [now, orchestration.heartbeatAt, orchestration.status]);

  return (
    <Stack
      as="section"
      aria-labelledby="investigation-workflow-title"
      gap="lg"
      data-test-id="investigation-orchestration"
    >
      <Flex align="start" justify="between" gap="md" wrap="wrap">
        <Stack gap="2xs">
          <Heading as="h2" id="investigation-workflow-title" size="lg">
            {t('Investigation plan')}
          </Heading>
          <Text variant="muted">
            {t('Seer is testing possible explanations before building the report.')}
          </Text>
        </Stack>
        <Badge variant={getStatusVariant(orchestration.status)}>
          {formatStatus(orchestration.phase)}
        </Badge>
      </Flex>

      {stale ? (
        <Alert.Container>
          <Alert variant="warning" data-test-id="investigation-orchestration-stale">
            {t(
              'Investigation progress has not updated for two minutes. Seer may be stalled.'
            )}
          </Alert>
        </Alert.Container>
      ) : null}

      {orchestration.status === 'failed' ? (
        <Alert.Container>
          <Alert variant="danger" data-test-id="investigation-orchestration-failed">
            {getPrimaryError(orchestration.errors)?.message ||
              t('The investigation could not continue.')}
          </Alert>
        </Alert.Container>
      ) : null}

      <Disclosure size="sm" variant="outline" defaultExpanded>
        <Disclosure.Title
          trailingItems={
            <Badge variant={getStatusVariant(orchestration.broadScan.status)}>
              {formatStatus(orchestration.broadScan.status)}
            </Badge>
          }
        >
          <Text bold>{t('Broad investigation')}</Text>
        </Disclosure.Title>
        <Disclosure.Content>
          <Stack gap="md">
            <Text as="p" variant="muted">
              {orchestration.broadScan.summary || getBroadScanPlaceholder(orchestration)}
            </Text>
            <WorkflowError error={orchestration.broadScan.error} />
            {orchestration.pendingInput ? (
              <Alert.Container>
                <Alert variant="info">{orchestration.pendingInput.prompt}</Alert>
              </Alert.Container>
            ) : null}
          </Stack>
        </Disclosure.Content>
      </Disclosure>

      {hypotheses.length > 0 ? (
        <Stack gap="md">
          <Flex aria-hidden="true" justify="center">
            <IconArrow direction="down" size="xs" />
          </Flex>
          <Container containerType="inline-size">
            <Grid
              role="list"
              aria-label={t('Investigation hypotheses')}
              columns={{'2xs': '1fr', md: 'repeat(2, minmax(0, 1fr))'}}
              gap="md"
            >
              {hypotheses.map(hypothesis => (
                <Container key={hypothesis.id} role="listitem" minWidth={0}>
                  <HypothesisNode hypothesis={hypothesis} />
                </Container>
              ))}
            </Grid>
          </Container>
        </Stack>
      ) : (
        <Container padding="md" background="secondary" radius="md">
          <Text variant="muted">
            {orchestration.status === 'awaiting_input'
              ? t('Seer needs more context before it can propose hypotheses.')
              : t('Seer is identifying hypotheses to test.')}
          </Text>
        </Container>
      )}

      <Flex aria-hidden="true" justify="center">
        <IconArrow direction="down" size="xs" />
      </Flex>

      <Container as="section" border="primary" radius="lg" padding="lg">
        <Stack gap="md">
          <Flex align="center" justify="between" gap="md" wrap="wrap">
            <Heading as="h3" size="md">
              {t('Investigation report')}
            </Heading>
            <Badge variant={getStatusVariant(orchestration.report.status)}>
              {formatStatus(orchestration.report.status)}
            </Badge>
          </Flex>
          <Text as="p" variant="muted">
            {getReportDescription({
              terminal,
              hasSupportedHypothesis,
              hasOnlyRejectedOrInconclusiveHypotheses,
              status: orchestration.report.status,
            })}
          </Text>
          <WorkflowError error={orchestration.report.error} />
        </Stack>
      </Container>
    </Stack>
  );
}

function HypothesisNode({hypothesis}: {hypothesis: InvestigationHypothesis}) {
  const steps = hypothesis.verificationSteps.toSorted(
    (left, right) => left.order - right.order
  );

  return (
    <Disclosure
      as="section"
      size="sm"
      variant="outline"
      defaultExpanded={hypothesis.status === 'running'}
      height="100%"
    >
      <Disclosure.Title>
        <Stack gap="xs" minWidth={0} width="100%">
          <Text bold align="left" wordBreak="break-word">
            {hypothesis.statement}
          </Text>
          <Flex align="center" gap="xs" wrap="wrap">
            <Badge variant={getStatusVariant(hypothesis.effectiveStatus)}>
              {getHypothesisStatusLabel(hypothesis)}
            </Badge>
            {hypothesis.confidence === null ? null : (
              <Text size="xs" variant="muted" tabular>
                {t('%s%% confidence', Math.round(hypothesis.confidence * 100))}
              </Text>
            )}
          </Flex>
        </Stack>
      </Disclosure.Title>
      <Disclosure.Content>
        <Stack gap="lg">
          <Stack gap="xs">
            <Heading as="h4" size="sm">
              {t('Why this is plausible')}
            </Heading>
            <Text as="p" variant="muted">
              {hypothesis.rationale}
            </Text>
          </Stack>

          <Stack gap="sm">
            <Heading as="h4" size="sm">
              {t('Verification plan')}
            </Heading>
            {steps.length > 0 ? (
              <Stack as="ol" gap="md" paddingLeft="xl">
                {steps.map(step => (
                  <Container as="li" key={step.id} minWidth={0}>
                    <VerificationStepDetails step={step} />
                  </Container>
                ))}
              </Stack>
            ) : (
              <Text variant="muted">{t('The verification plan is being prepared.')}</Text>
            )}
          </Stack>

          <EvidenceList evidence={hypothesis.evidence} />
          <WorkflowError error={hypothesis.error} />
        </Stack>
      </Disclosure.Content>
    </Disclosure>
  );
}

function VerificationStepDetails({step}: {step: InvestigationVerificationStep}) {
  return (
    <Stack gap="xs">
      <Flex align="center" justify="between" gap="sm" wrap="wrap">
        <Text bold>{step.title}</Text>
        <Badge variant={getStatusVariant(step.status)}>{formatStatus(step.status)}</Badge>
      </Flex>
      <Text as="p" size="sm" variant="muted">
        {step.objective}
      </Text>
      <Text as="p" size="sm" variant="muted">
        <Text as="span" bold>
          {t('Method:')}
        </Text>{' '}
        {step.method}
      </Text>
      {step.result ? (
        <Text as="p" size="sm">
          {step.result}
        </Text>
      ) : null}
      <EvidenceList evidence={step.evidence} />
      <WorkflowError error={step.error} />
    </Stack>
  );
}

function EvidenceList({evidence}: {evidence: InvestigationOrchestrationEvidence[]}) {
  if (evidence.length === 0) {
    return null;
  }

  return (
    <Stack gap="sm">
      <Heading as="h5" size="xs">
        {t('Evidence')}
      </Heading>
      <Stack role="list" gap="xs">
        {evidence.map(item => (
          <Container
            key={item.id}
            role="listitem"
            background="secondary"
            padding="sm"
            radius="sm"
          >
            <Stack gap="2xs">
              <Flex align="center" gap="xs" wrap="wrap">
                <EvidenceTitle evidence={item} />
                <Badge variant="muted">{formatStatus(item.kind)}</Badge>
              </Flex>
              {item.summary ? (
                <Text size="sm" variant="muted">
                  {item.summary}
                </Text>
              ) : null}
              {item.reference ? (
                <Text size="xs" variant="muted" monospace wordBreak="break-word">
                  {item.reference}
                </Text>
              ) : null}
            </Stack>
          </Container>
        ))}
      </Stack>
    </Stack>
  );
}

function EvidenceTitle({evidence}: {evidence: InvestigationOrchestrationEvidence}) {
  if (evidence.url?.startsWith('/')) {
    return <Link to={evidence.url}>{evidence.title}</Link>;
  }
  if (evidence.url && /^https?:\/\//i.test(evidence.url)) {
    return <ExternalLink href={evidence.url}>{evidence.title}</ExternalLink>;
  }
  return <Text bold>{evidence.title}</Text>;
}

function WorkflowError({error}: {error: InvestigationOrchestrationError | null}) {
  if (!error) {
    return null;
  }
  return (
    <Alert.Container>
      <Alert variant="danger">{error.message}</Alert>
    </Alert.Container>
  );
}

function getBroadScanPlaceholder(orchestration: InvestigationOrchestration) {
  if (orchestration.status === 'awaiting_input') {
    return t('Waiting for the context needed to begin the broad investigation.');
  }
  if (orchestration.broadScan.status === 'completed') {
    return t('The broad investigation is complete.');
  }
  return t('Seer is reviewing relevant organization data and forming hypotheses.');
}

function getReportDescription({
  terminal,
  hasSupportedHypothesis,
  hasOnlyRejectedOrInconclusiveHypotheses,
  status,
}: {
  hasOnlyRejectedOrInconclusiveHypotheses: boolean;
  hasSupportedHypothesis: boolean;
  status: InvestigationOrchestration['report']['status'];
  terminal: boolean;
}) {
  if (terminal && hasOnlyRejectedOrInconclusiveHypotheses) {
    return t(
      'No hypothesis was supported. The report explains rejected theories, remaining gaps, and what to test next.'
    );
  }
  if (status === 'composing') {
    return t('Seer is building the notebook from the settled hypotheses and evidence.');
  }
  if (status === 'partial_failed' || status === 'failed') {
    return t('Report generation stopped. Completed notebook blocks remain available.');
  }
  if (status === 'completed' && hasSupportedHypothesis) {
    return t('The notebook explains the supported causes and recommended next steps.');
  }
  return t('The report begins after the current hypotheses have been settled.');
}

function getHypothesisStatusLabel(hypothesis: InvestigationHypothesis) {
  if (hypothesis.decisionSource === 'user') {
    if (hypothesis.effectiveStatus === 'accepted') {
      return t('Accepted by you');
    }
    if (hypothesis.effectiveStatus === 'rejected') {
      return t('Rejected by you');
    }
  }
  return formatStatus(hypothesis.effectiveStatus);
}

function getPrimaryError(errors: InvestigationOrchestrationError[]) {
  return errors.at(-1);
}

function formatStatus(status: string) {
  return status.replaceAll('_', ' ').replace(/^./, character => character.toUpperCase());
}

function getStatusVariant(
  status:
    | InvestigationHypothesisStatus
    | InvestigationOrchestrationStatus
    | InvestigationOrchestrationWorkStatus
    | InvestigationOrchestration['phase']
    | InvestigationOrchestration['report']['status']
): React.ComponentProps<typeof Badge>['variant'] {
  if (['completed', 'supported', 'accepted'].includes(status)) {
    return 'success';
  }
  if (['failed', 'refuted', 'rejected', 'cancelled'].includes(status)) {
    return 'danger';
  }
  if (
    [
      'awaiting_input',
      'blocked',
      'reauth_required',
      'stalled',
      'inconclusive',
      'partial_failed',
    ].includes(status)
  ) {
    return 'warning';
  }
  if (['queued', 'running', 'processing', 'composing'].includes(status)) {
    return 'info';
  }
  return 'muted';
}

export function isOrchestrationTerminal(status: InvestigationOrchestrationStatus) {
  return ['completed', 'failed', 'cancelled'].includes(status);
}

export function isInvestigationOrchestrationStale(
  orchestration: InvestigationOrchestration,
  now = Date.now()
) {
  if (isOrchestrationTerminal(orchestration.status) || !orchestration.heartbeatAt) {
    return false;
  }
  const heartbeat = Date.parse(orchestration.heartbeatAt);
  return Number.isFinite(heartbeat) && now - heartbeat >= STALE_AFTER_MS;
}
