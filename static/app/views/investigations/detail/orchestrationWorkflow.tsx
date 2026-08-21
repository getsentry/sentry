import {Fragment, useEffect, useState} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Badge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Input} from '@sentry/scraps/input';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {
  InvestigationHypothesis,
  InvestigationHypothesisStatus,
  InvestigationOrchestration,
  InvestigationOrchestrationCommand,
  InvestigationOrchestrationError,
  InvestigationOrchestrationEvidence,
  InvestigationOrchestrationStatus,
  InvestigationOrchestrationWorkStatus,
  InvestigationToolActivity,
  InvestigationVerificationStep,
} from 'sentry/views/investigations/types';

import type {
  OrchestrationCommandState,
  OrchestrationCommandTarget,
} from './useOrchestrationCommands';

const STALE_AFTER_MS = 2 * 60 * 1000;

type Props = {
  orchestration: InvestigationOrchestration;
  commandState?: OrchestrationCommandState;
  now?: number;
  onCommand?: (
    command: InvestigationOrchestrationCommand,
    target: OrchestrationCommandTarget
  ) => void;
};

export function InvestigationOrchestrationWorkflow({
  commandState,
  orchestration,
  now,
  onCommand,
}: Props) {
  const [, setStaleCheck] = useState(0);
  const currentTime = now ?? Date.now();
  const hypotheses = orchestration.hypotheses.toSorted(
    (left, right) => left.order - right.order
  );
  const stale = isInvestigationOrchestrationStale(orchestration, currentTime);
  const orchestrationProgressAt = getOrchestrationProgressAt(orchestration);
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
      !orchestrationProgressAt
    ) {
      return;
    }
    const progressAt = Date.parse(orchestrationProgressAt);
    if (!Number.isFinite(progressAt)) {
      return;
    }
    const timeout = window.setTimeout(
      () => setStaleCheck(value => value + 1),
      Math.max(progressAt + STALE_AFTER_MS - Date.now(), 0)
    );
    return () => window.clearTimeout(timeout);
  }, [now, orchestration.status, orchestrationProgressAt]);

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
        <Badge
          role="status"
          aria-live="polite"
          variant={getStatusVariant(orchestration.status)}
        >
          {formatStatus(orchestration.phase)}
        </Badge>
      </Flex>

      {onCommand && commandState ? (
        <WorkflowCommandBar
          commandState={commandState}
          onCommand={onCommand}
          orchestration={orchestration}
          stale={stale}
        />
      ) : null}

      {stale ? (
        <Alert.Container>
          <Alert variant="warning" data-test-id="investigation-orchestration-stale">
            {onCommand
              ? t(
                  'Investigation progress has not updated for two minutes. Retry the investigation to reconnect and continue.'
                )
              : t(
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
            <Badge
              role="status"
              aria-live="polite"
              variant={getStatusVariant(orchestration.broadScan.status)}
            >
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
            <AttemptDetails
              attempt={orchestration.broadScan.attempt}
              automaticRetryCount={orchestration.broadScan.automaticRetryCount}
            />
            <ToolActivityList activity={orchestration.broadScan.toolActivity ?? []} />
            <WorkflowError error={orchestration.broadScan.error} />
            {orchestration.pendingInput ? (
              <Stack gap="md">
                <Alert.Container>
                  <Alert variant="info">{orchestration.pendingInput.prompt}</Alert>
                </Alert.Container>
                {onCommand && commandState ? (
                  <ProvideInputForm
                    commandState={commandState}
                    missingFields={orchestration.pendingInput.missingFields}
                    onCommand={onCommand}
                  />
                ) : null}
              </Stack>
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
                  <HypothesisNode
                    commandState={commandState}
                    hypothesis={hypothesis}
                    onCommand={onCommand}
                    primary={orchestration.report.primaryHypothesisId === hypothesis.id}
                  />
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
            <Badge
              role="status"
              aria-live="polite"
              variant={getStatusVariant(orchestration.report.status)}
            >
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
          <AttemptDetails
            automaticRetryCount={orchestration.report.automaticRetryCount}
          />
          {orchestration.report.suggestedHypotheses?.length ? (
            <SuggestedHypotheses
              commandState={commandState}
              onCommand={onCommand}
              suggestions={orchestration.report.suggestedHypotheses}
            />
          ) : null}
          {onCommand && commandState ? (
            <Stack gap="md">
              <SteeringForm
                commandState={commandState}
                description={t(
                  'Ask Seer to add evidence, add or remove a block, or change the report order.'
                )}
                label={t('Steer the report')}
                onSubmit={instruction =>
                  onCommand({type: 'steer', target: 'report', instruction}, 'report')
                }
                target="report"
              />
              {['partial_failed', 'failed'].includes(orchestration.report.status) ||
              ['stalled', 'reauth_required'].includes(
                orchestration.report.currentBlockStatus ?? ''
              ) ? (
                <Button
                  size="sm"
                  busy={commandState.pendingTarget === 'report-action'}
                  disabled={commandState.isPending}
                  onClick={() =>
                    onCommand({type: 'retry', target: 'report'}, 'report-action')
                  }
                >
                  {t('Retry report')}
                </Button>
              ) : null}
            </Stack>
          ) : null}
        </Stack>
      </Container>
    </Stack>
  );
}

function HypothesisNode({
  commandState,
  hypothesis,
  primary,
  onCommand,
}: {
  hypothesis: InvestigationHypothesis;
  primary: boolean;
  commandState?: OrchestrationCommandState;
  onCommand?: (
    command: InvestigationOrchestrationCommand,
    target: OrchestrationCommandTarget
  ) => void;
}) {
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
            <Badge
              role="status"
              aria-live="polite"
              variant={getStatusVariant(hypothesis.effectiveStatus)}
            >
              {getHypothesisStatusLabel(hypothesis)}
            </Badge>
            {primary ? <Badge variant="info">{t('Primary')}</Badge> : null}
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
          <AttemptDetails
            attempt={hypothesis.attempt}
            automaticRetryCount={hypothesis.automaticRetryCount}
          />
          <ToolActivityList activity={hypothesis.toolActivity ?? []} />
          <WorkflowError error={hypothesis.error} />
          {hypothesis.decisionSource === 'user' &&
          hypothesis.effectiveStatus === 'accepted' &&
          hypothesis.agentVerdict?.verdict !== 'supported' ? (
            <Alert.Container>
              <Alert variant="info">
                {t(
                  'Accepted by you. Seer has not verified this hypothesis, so the report will describe it as unverified.'
                )}
              </Alert>
            </Alert.Container>
          ) : null}
          {hypothesis.agentVerdict ? (
            <Stack gap="xs">
              <Flex align="center" gap="xs" wrap="wrap">
                <Text bold>{t('Agent verdict')}</Text>
                <Badge
                  role="status"
                  aria-live="polite"
                  variant={getStatusVariant(hypothesis.agentVerdict.verdict)}
                >
                  {formatStatus(hypothesis.agentVerdict.verdict)}
                </Badge>
              </Flex>
              <Text size="sm" variant="muted">
                {hypothesis.agentVerdict.rationale}
              </Text>
            </Stack>
          ) : null}
          {onCommand && commandState ? (
            <HypothesisControls
              commandState={commandState}
              hypothesis={hypothesis}
              onCommand={onCommand}
            />
          ) : null}
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
        <Badge role="status" aria-live="polite" variant={getStatusVariant(step.status)}>
          {formatStatus(step.status)}
        </Badge>
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

function AttemptDetails({
  attempt,
  automaticRetryCount,
}: {
  attempt?: number;
  automaticRetryCount?: number;
}) {
  if (attempt === undefined && !automaticRetryCount) {
    return null;
  }
  return (
    <Flex align="center" gap="xs" wrap="wrap">
      {attempt === undefined ? null : (
        <Text size="xs" variant="muted" tabular>
          {t('Attempt %s', attempt + 1)}
        </Text>
      )}
      {automaticRetryCount ? (
        <Badge variant="warning">
          {automaticRetryCount === 1
            ? t('Automatically retried once')
            : t('Automatically retried %s times', automaticRetryCount)}
        </Badge>
      ) : null}
    </Flex>
  );
}

function ToolActivityList({activity}: {activity: InvestigationToolActivity[]}) {
  if (activity.length === 0) {
    return null;
  }
  return (
    <Stack gap="sm">
      <Heading as="h4" size="sm">
        {t('Tool activity')}
      </Heading>
      <Stack role="list" aria-label={t('Tool activity')} gap="xs">
        {activity.map(item => (
          <Flex
            key={item.id}
            role="listitem"
            align="center"
            justify="between"
            gap="sm"
            wrap="wrap"
          >
            <Flex align="center" gap="xs" minWidth={0}>
              <Text size="sm" wordBreak="break-word">
                {item.title}
              </Text>
              <Badge variant="muted">{formatStatus(item.kind)}</Badge>
            </Flex>
            <Badge
              role="status"
              aria-live="polite"
              variant={getStatusVariant(item.status)}
            >
              {formatStatus(item.status)}
            </Badge>
          </Flex>
        ))}
      </Stack>
    </Stack>
  );
}

function SuggestedHypotheses({
  commandState,
  onCommand,
  suggestions,
}: {
  suggestions: NonNullable<InvestigationOrchestration['report']['suggestedHypotheses']>;
  commandState?: OrchestrationCommandState;
  onCommand?: (
    command: InvestigationOrchestrationCommand,
    target: OrchestrationCommandTarget
  ) => void;
}) {
  return (
    <Stack gap="sm">
      <Heading as="h4" size="sm">
        {t('What to test next')}
      </Heading>
      <Stack role="list" aria-label={t('Suggested hypotheses')} gap="sm">
        {suggestions.map((suggestion, index) => (
          <Container
            key={`${suggestion.statement}-${index}`}
            role="listitem"
            background="secondary"
            padding="sm"
            radius="sm"
          >
            <Flex align="start" justify="between" gap="md" wrap="wrap">
              <Stack gap="2xs" minWidth={0} flex={1}>
                <Text bold wordBreak="break-word">
                  {suggestion.statement}
                </Text>
                {suggestion.rationale ? (
                  <Text size="sm" variant="muted">
                    {suggestion.rationale}
                  </Text>
                ) : null}
              </Stack>
              {onCommand && commandState ? (
                <Button
                  size="sm"
                  aria-label={t('Test hypothesis: %s', suggestion.statement)}
                  busy={commandState.pendingTarget === 'add-hypothesis'}
                  disabled={commandState.isPending}
                  onClick={() =>
                    onCommand(
                      {
                        type: 'add_hypothesis',
                        statement: suggestion.statement,
                        rationale: suggestion.rationale || null,
                      },
                      'add-hypothesis'
                    )
                  }
                >
                  {t('Test this')}
                </Button>
              ) : null}
            </Flex>
          </Container>
        ))}
      </Stack>
      {commandState ? (
        <CommandFeedback commandState={commandState} targets={['add-hypothesis']} />
      ) : null}
    </Stack>
  );
}

function WorkflowCommandBar({
  commandState,
  onCommand,
  orchestration,
  stale,
}: {
  commandState: OrchestrationCommandState;
  onCommand: (
    command: InvestigationOrchestrationCommand,
    target: OrchestrationCommandTarget
  ) => void;
  orchestration: InvestigationOrchestration;
  stale: boolean;
}) {
  const terminal = isOrchestrationTerminal(orchestration.status);
  const primaryError = getPrimaryError(orchestration.errors);
  const canRetryRun =
    stale ||
    ['failed', 'stalled', 'cancelled', 'reauth_required'].includes(
      orchestration.broadScan.status
    ) ||
    (orchestration.runId === null &&
      primaryError?.code === 'seer_dispatch_failed' &&
      primaryError.retryable);
  return (
    <Stack gap="md">
      <Container containerType="inline-size">
        <Grid columns={{'2xs': '1fr', md: 'repeat(2, minmax(0, 1fr))'}} gap="md">
          <AddHypothesisForm commandState={commandState} onCommand={onCommand} />
          <SteeringForm
            commandState={commandState}
            description={t(
              'Redirect the broad investigation without editing an individual hypothesis.'
            )}
            label={t('Steer the investigation')}
            onSubmit={instruction =>
              onCommand({type: 'steer', target: 'workflow', instruction}, 'workflow')
            }
            target="workflow"
          />
        </Grid>
      </Container>
      <Flex align="center" gap="sm" wrap="wrap">
        {canRetryRun ? (
          <Button
            size="sm"
            busy={commandState.pendingTarget === 'run'}
            disabled={commandState.isPending}
            onClick={() => onCommand({type: 'retry', target: 'run'}, 'run')}
          >
            {t('Retry investigation')}
          </Button>
        ) : null}
        {terminal ? null : (
          <Button
            size="sm"
            variant="danger"
            busy={commandState.pendingTarget === 'cancel'}
            disabled={commandState.isPending}
            onClick={() =>
              onCommand({type: 'cancel', reason: t('Cancelled by the user')}, 'cancel')
            }
          >
            {t('Cancel investigation')}
          </Button>
        )}
        <CommandFeedback commandState={commandState} targets={['run', 'cancel']} />
      </Flex>
    </Stack>
  );
}

function ProvideInputForm({
  commandState,
  missingFields,
  onCommand,
}: {
  commandState: OrchestrationCommandState;
  missingFields: Array<'prompt' | 'time_range'>;
  onCommand: (
    command: InvestigationOrchestrationCommand,
    target: OrchestrationCommandTarget
  ) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const needsPrompt = missingFields.includes('prompt');
  const needsTimeRange = missingFields.includes('time_range');
  const valid =
    (!needsPrompt || Boolean(prompt.trim())) &&
    (!needsTimeRange || Boolean(start && end && Date.parse(start) < Date.parse(end)));

  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        if (!valid) {
          return;
        }
        onCommand(
          {
            type: 'provide_input',
            ...(needsPrompt ? {prompt: prompt.trim()} : {}),
            ...(needsTimeRange
              ? {
                  timeRange: {
                    start: new Date(start).toISOString(),
                    end: new Date(end).toISOString(),
                  },
                }
              : {}),
          },
          'input'
        );
      }}
    >
      <Stack gap="md">
        {needsPrompt ? (
          <Stack gap="xs">
            <Text as="label" htmlFor="investigation-input-prompt" bold>
              {t('What should Seer investigate?')}
            </Text>
            <TextArea
              id="investigation-input-prompt"
              autosize
              rows={3}
              value={prompt}
              onChange={event => setPrompt(event.target.value)}
            />
          </Stack>
        ) : null}
        {needsTimeRange ? (
          <Container containerType="inline-size">
            <Grid columns={{'2xs': '1fr', sm: 'repeat(2, minmax(0, 1fr))'}} gap="md">
              <Stack gap="xs">
                <Text as="label" htmlFor="investigation-input-start" bold>
                  {t('Start time')}
                </Text>
                <Input
                  id="investigation-input-start"
                  type="datetime-local"
                  value={start}
                  onChange={event => setStart(event.target.value)}
                />
              </Stack>
              <Stack gap="xs">
                <Text as="label" htmlFor="investigation-input-end" bold>
                  {t('End time')}
                </Text>
                <Input
                  id="investigation-input-end"
                  type="datetime-local"
                  value={end}
                  onChange={event => setEnd(event.target.value)}
                />
              </Stack>
            </Grid>
          </Container>
        ) : null}
        <Flex align="center" gap="sm" wrap="wrap">
          <Button
            type="submit"
            size="sm"
            variant="primary"
            busy={commandState.pendingTarget === 'input'}
            disabled={!valid || commandState.isPending}
          >
            {t('Start investigation')}
          </Button>
          <CommandFeedback commandState={commandState} targets={['input']} />
        </Flex>
      </Stack>
    </form>
  );
}

function AddHypothesisForm({
  commandState,
  onCommand,
}: {
  commandState: OrchestrationCommandState;
  onCommand: (
    command: InvestigationOrchestrationCommand,
    target: OrchestrationCommandTarget
  ) => void;
}) {
  const [statement, setStatement] = useState('');
  const [rationale, setRationale] = useState('');
  return (
    <Disclosure size="sm" variant="outline">
      <Disclosure.Title>{t('Add a hypothesis')}</Disclosure.Title>
      <Disclosure.Content>
        <form
          onSubmit={event => {
            event.preventDefault();
            if (!statement.trim()) {
              return;
            }
            onCommand(
              {
                type: 'add_hypothesis',
                statement: statement.trim(),
                rationale: rationale.trim() || null,
              },
              'add-hypothesis'
            );
          }}
        >
          <Stack gap="md">
            <Stack gap="xs">
              <Text as="label" htmlFor="new-hypothesis-statement" bold>
                {t('Hypothesis')}
              </Text>
              <Input
                id="new-hypothesis-statement"
                value={statement}
                onChange={event => setStatement(event.target.value)}
              />
            </Stack>
            <Stack gap="xs">
              <Text as="label" htmlFor="new-hypothesis-rationale" bold>
                {t('Why should Seer test this? (optional)')}
              </Text>
              <TextArea
                id="new-hypothesis-rationale"
                autosize
                rows={2}
                value={rationale}
                onChange={event => setRationale(event.target.value)}
              />
            </Stack>
            <Flex align="center" gap="sm" wrap="wrap">
              <Button
                type="submit"
                size="sm"
                variant="primary"
                busy={commandState.pendingTarget === 'add-hypothesis'}
                disabled={!statement.trim() || commandState.isPending}
              >
                {t('Test hypothesis')}
              </Button>
              <CommandFeedback commandState={commandState} targets={['add-hypothesis']} />
            </Flex>
          </Stack>
        </form>
      </Disclosure.Content>
    </Disclosure>
  );
}

function HypothesisControls({
  commandState,
  hypothesis,
  onCommand,
}: {
  commandState: OrchestrationCommandState;
  hypothesis: InvestigationHypothesis;
  onCommand: (
    command: InvestigationOrchestrationCommand,
    target: OrchestrationCommandTarget
  ) => void;
}) {
  const target = `hypothesis:${hypothesis.id}` as const;
  const decisionTarget = `hypothesis-decision:${hypothesis.id}` as const;
  const hasUserDecision = hypothesis.decisionSource === 'user';
  return (
    <Stack gap="md">
      <Flex align="center" gap="sm" wrap="wrap">
        {hasUserDecision ? (
          <Button
            size="sm"
            busy={commandState.pendingTarget === decisionTarget}
            disabled={commandState.isPending}
            onClick={() =>
              onCommand(
                {
                  type: 'set_hypothesis_disposition',
                  hypothesisId: hypothesis.id,
                  disposition: null,
                },
                decisionTarget
              )
            }
          >
            {t('Undo decision')}
          </Button>
        ) : (
          <Fragment>
            <Button
              size="sm"
              variant="primary"
              busy={commandState.pendingTarget === decisionTarget}
              disabled={commandState.isPending}
              onClick={() =>
                onCommand(
                  {
                    type: 'set_hypothesis_disposition',
                    hypothesisId: hypothesis.id,
                    disposition: 'accepted',
                  },
                  decisionTarget
                )
              }
            >
              {t('Accept')}
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={commandState.isPending}
              onClick={() =>
                onCommand(
                  {
                    type: 'set_hypothesis_disposition',
                    hypothesisId: hypothesis.id,
                    disposition: 'rejected',
                  },
                  decisionTarget
                )
              }
            >
              {t('Reject')}
            </Button>
          </Fragment>
        )}
        {['failed', 'stalled', 'reauth_required'].includes(hypothesis.status) ? (
          <Button
            size="sm"
            busy={commandState.pendingTarget === decisionTarget}
            disabled={commandState.isPending}
            onClick={() =>
              onCommand(
                {
                  type: 'retry',
                  target: 'hypothesis',
                  targetId: hypothesis.id,
                },
                decisionTarget
              )
            }
          >
            {t('Retry hypothesis')}
          </Button>
        ) : null}
        <CommandFeedback commandState={commandState} targets={[decisionTarget]} />
      </Flex>
      <SteeringForm
        commandState={commandState}
        description={t('Change how Seer tests only this hypothesis.')}
        label={t('Steer this hypothesis')}
        onSubmit={instruction =>
          onCommand(
            {
              type: 'steer',
              target: 'hypothesis',
              targetId: hypothesis.id,
              instruction,
            },
            target
          )
        }
        target={target}
      />
    </Stack>
  );
}

function SteeringForm({
  commandState,
  description,
  label,
  onSubmit,
  target,
}: {
  commandState: OrchestrationCommandState;
  description: string;
  label: string;
  onSubmit: (instruction: string) => void;
  target: OrchestrationCommandTarget;
}) {
  const [instruction, setInstruction] = useState('');
  const inputId = `steer-${target.replace(':', '-')}`;
  return (
    <Disclosure size="sm" variant="outline">
      <Disclosure.Title>{label}</Disclosure.Title>
      <Disclosure.Content>
        <form
          onSubmit={event => {
            event.preventDefault();
            if (instruction.trim()) {
              onSubmit(instruction.trim());
            }
          }}
        >
          <Stack gap="md">
            <Text size="sm" variant="muted">
              {description}
            </Text>
            <Text as="label" htmlFor={inputId} bold>
              {t('Instructions')}
            </Text>
            <TextArea
              id={inputId}
              autosize
              rows={2}
              value={instruction}
              onChange={event => setInstruction(event.target.value)}
            />
            <Flex align="center" gap="sm" wrap="wrap">
              <Button
                type="submit"
                size="sm"
                variant="primary"
                busy={commandState.pendingTarget === target}
                disabled={!instruction.trim() || commandState.isPending}
              >
                {t('Send instructions')}
              </Button>
              <CommandFeedback commandState={commandState} targets={[target]} />
            </Flex>
          </Stack>
        </form>
      </Disclosure.Content>
    </Disclosure>
  );
}

function CommandFeedback({
  commandState,
  targets,
}: {
  commandState: OrchestrationCommandState;
  targets: OrchestrationCommandTarget[];
}) {
  if (commandState.pendingTarget && targets.includes(commandState.pendingTarget)) {
    return (
      <Text role="status" size="sm" variant="muted">
        {t('Updating…')}
      </Text>
    );
  }
  if (
    commandState.error &&
    commandState.errorTarget &&
    targets.includes(commandState.errorTarget)
  ) {
    return (
      <Text role="alert" size="sm" variant="danger">
        {commandState.error}
      </Text>
    );
  }
  return null;
}

export function InvestigationBlockSteering({
  commandState,
  onCommand,
  stableAgentKey,
}: {
  commandState: OrchestrationCommandState;
  onCommand: (
    command: InvestigationOrchestrationCommand,
    target: OrchestrationCommandTarget
  ) => void;
  stableAgentKey: string;
}) {
  const target = `block:${stableAgentKey}` as const;
  return (
    <Container paddingTop="md">
      <SteeringForm
        commandState={commandState}
        description={t(
          'Ask Seer to edit, replace, move, or remove this report block without rebuilding unrelated blocks.'
        )}
        label={t('Steer this report block')}
        onSubmit={instruction =>
          onCommand(
            {
              type: 'steer',
              target: 'block',
              targetId: stableAgentKey,
              instruction,
            },
            target
          )
        }
        target={target}
      />
    </Container>
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
  if (evidence.url && /^\/(?![\\/])/.test(evidence.url)) {
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
  if (isOrchestrationTerminal(orchestration.status)) {
    return false;
  }
  const progressAt = Date.parse(getOrchestrationProgressAt(orchestration) ?? '');
  return Number.isFinite(progressAt) && now - progressAt >= STALE_AFTER_MS;
}

function getOrchestrationProgressAt(orchestration: InvestigationOrchestration) {
  return orchestration.heartbeatAt || orchestration.updatedAt || null;
}
