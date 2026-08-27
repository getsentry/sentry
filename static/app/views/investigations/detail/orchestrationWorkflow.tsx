import '@xyflow/react/dist/style.css';

import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {
  Background,
  BackgroundVariant,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';

import {Alert} from '@sentry/scraps/alert';
import {Badge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import {Heading, Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {IconArrow, IconCheckmark, IconClose} from 'sentry/icons';
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

type FlowTone = 'negative' | 'neutral' | 'positive';

const FlowCard = styled(Container)<{$tone: FlowTone; $opacity?: number}>`
  background: ${p => p.theme.tokens.background.primary};
  opacity: ${p => p.$opacity ?? 1};
  border-color: ${p =>
    p.$tone === 'positive'
      ? p.theme.colors.green400
      : p.$tone === 'negative'
        ? p.theme.colors.red400
        : p.theme.tokens.border.primary};
`;

const GraphCanvas = styled('div')`
  width: 100%;
  min-height: 340px;
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;
  background: ${p => p.theme.tokens.background.secondary};

  .react-flow__node {
    border: 0;
    padding: 0;
    background: transparent;
    box-shadow: none;
    width: 220px;
  }

  .react-flow__edge-path {
    stroke: ${p => p.theme.tokens.border.primary};
    stroke-width: 1.5;
  }

  .react-flow__edge.lineage-supported .react-flow__edge-path {
    stroke: ${p => p.theme.colors.green400};
    opacity: 0.9;
  }

  .react-flow__edge.lineage-muted .react-flow__edge-path {
    opacity: 0.38;
  }
`;

const ClampedText = styled(Text)<{$lines: number}>`
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: ${p => p.$lines};
`;

const GraphNodeButton = styled('button')`
  width: 100%;
  padding: 0;
  text-align: left;
  background: transparent;
  border: 0;
`;

const ComposerForm = styled('form')`
  position: fixed;
  z-index: ${p => p.theme.zIndex.header};
  left: 50%;
  bottom: ${p => p.theme.space.xl};
  transform: translateX(-50%);
  width: min(720px, calc(100vw - ${p => p.theme.space['3xl']}));
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.lg};
  padding: ${p => p.theme.space.md};
  background: ${p => p.theme.tokens.background.primary};
  box-shadow: ${p => p.theme.shadow.high};

  &:focus-within {
    border-color: ${p => p.theme.tokens.border.accent.vibrant};
    box-shadow: 0 0 0 1px ${p => p.theme.tokens.focus.default};
  }
`;

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
  const waitingForInput =
    orchestration.status === 'awaiting_input' || Boolean(orchestration.pendingInput);
  const stale =
    !waitingForInput && isInvestigationOrchestrationStale(orchestration, currentTime);
  const orchestrationProgressAt = getOrchestrationProgressAt(orchestration);

  useEffect(() => {
    if (
      now !== undefined ||
      isOrchestrationTerminal(orchestration.status) ||
      waitingForInput ||
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
  }, [now, orchestration.status, orchestrationProgressAt, waitingForInput]);

  if (waitingForInput && orchestration.pendingInput && onCommand && commandState) {
    return (
      <Container as="section" data-test-id="investigation-orchestration">
        <InvestigationComposer
          commandState={commandState}
          mode="intake"
          onCommand={onCommand}
        />
      </Container>
    );
  }

  return (
    <Stack
      as="section"
      aria-label={t('Investigation workflow')}
      gap="lg"
      paddingBottom="3xl"
      data-stale={stale}
      data-test-id="investigation-orchestration"
    >
      {orchestration.status === 'failed' ? (
        <Alert.Container>
          <Alert variant="danger" data-test-id="investigation-orchestration-failed">
            {getPrimaryError(orchestration.errors)?.message ||
              t('The investigation could not continue.')}
          </Alert>
        </Alert.Container>
      ) : null}

      {isWorkInProgress(orchestration.broadScan.status) ? (
        <AgentUpdates
          activity={orchestration.broadScan.toolActivity ?? []}
          emptyLabel={t('Researching relevant Sentry data…')}
        />
      ) : null}

      {hypotheses.length > 0 ? (
        <Disclosure as="section" size="sm" variant="outline" defaultExpanded>
          <Disclosure.Title
            trailingItems={<Badge variant="muted">{hypotheses.length}</Badge>}
          >
            <Text bold>{t('Hypotheses')}</Text>
          </Disclosure.Title>
          <Disclosure.Content style={{padding: 0, overflow: 'hidden'}}>
            <HypothesisGraph
              key={hypotheses
                .map(hypothesis =>
                  [
                    hypothesis.id,
                    ...hypothesis.verificationSteps.map(step => step.id),
                  ].join(':')
                )
                .join('|')}
              broadScan={orchestration.broadScan}
              commandState={commandState}
              hypotheses={hypotheses}
              onCommand={onCommand}
              primaryHypothesisId={orchestration.report.primaryHypothesisId}
            />
          </Disclosure.Content>
        </Disclosure>
      ) : null}

      {isReportCompositionActive(orchestration) ? (
        <ReportCompositionUpdates orchestration={orchestration} />
      ) : null}

      {onCommand && commandState ? (
        <InvestigationComposer
          commandState={commandState}
          mode="steer"
          onCommand={onCommand}
        />
      ) : null}
    </Stack>
  );
}

function HypothesisGraph({
  broadScan,
  commandState,
  hypotheses,
  onCommand,
  primaryHypothesisId,
}: {
  broadScan: InvestigationOrchestration['broadScan'];
  hypotheses: InvestigationHypothesis[];
  primaryHypothesisId: string | null;
  commandState?: OrchestrationCommandState;
  onCommand?: (
    command: InvestigationOrchestrationCommand,
    target: OrchestrationCommandTarget
  ) => void;
}) {
  const {openModal} = useModal();
  const laneGap = 244;
  const stepGap = 72;
  const activityGap = 76;
  const rootY = 12;
  const hypothesisY = 104;
  const firstStepY = 234;
  const rootX = Math.max(0, ((hypotheses.length - 1) * laneGap) / 2);
  const openHypothesis = (hypothesisId: string) => {
    const hypothesis = hypotheses.find(item => item.id === hypothesisId);
    if (!hypothesis) {
      return;
    }
    openModal(deps => (
      <HypothesisDetailModal
        {...deps}
        commandState={commandState}
        hypothesis={hypothesis}
        onCommand={onCommand}
        primary={primaryHypothesisId === hypothesis.id}
      />
    ));
  };
  const nodes: Node[] = [
    {
      id: 'investigation-root',
      position: {x: rootX, y: rootY},
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: {
        label: (
          <FlowCard
            $opacity={0.92}
            $tone="neutral"
            background="primary"
            border="primary"
            radius="md"
            padding="sm"
          >
            <Stack gap="xs">
              <Text bold>{t('Investigation')}</Text>
              <ClampedText $lines={2} size="xs" variant="muted">
                {broadScan.summary ||
                  t('Forming hypotheses from the investigation prompt.')}
              </ClampedText>
            </Stack>
          </FlowCard>
        ),
      },
    },
  ];
  const edges: Edge[] = [];
  const laneBottoms: number[] = [];

  for (const [laneIndex, hypothesis] of hypotheses.entries()) {
    const lineageSupported = isHypothesisSupported(hypothesis);
    const lineageTone: FlowTone = lineageSupported ? 'positive' : 'neutral';
    const lineageClassName = lineageSupported ? 'lineage-supported' : 'lineage-muted';
    const x = laneIndex * laneGap;
    const hypothesisNodeId = `hypothesis-${hypothesis.id}`;
    const steps = hypothesis.verificationSteps.toSorted(
      (left, right) => left.order - right.order
    );
    const activeActivity = getActiveToolActivity(hypothesis.toolActivity ?? []);
    nodes.push({
      id: hypothesisNodeId,
      className: 'nopan',
      position: {x, y: hypothesisY},
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: {
        label: (
          <HypothesisNode
            commandState={commandState}
            hypothesis={hypothesis}
            onCommand={onCommand}
            primary={primaryHypothesisId === hypothesis.id}
          />
        ),
      },
    });
    edges.push({
      id: `root-${hypothesis.id}`,
      source: 'investigation-root',
      target: hypothesisNodeId,
      className: lineageClassName,
    });

    let previousNodeId = hypothesisNodeId;
    let cursorY = firstStepY;
    for (const step of steps) {
      const stepNodeId = `${hypothesisNodeId}-step-${step.id}`;
      nodes.push({
        id: stepNodeId,
        className: 'nopan',
        position: {x, y: cursorY},
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: {
          hypothesisId: hypothesis.id,
          label: (
            <GraphNodeButton
              className="nodrag nopan"
              aria-label={t('View verification step: %s', step.title)}
              onPointerDown={event => event.stopPropagation()}
              onClick={() => openHypothesis(hypothesis.id)}
            >
              <FlowCard
                $opacity={lineageSupported ? 0.9 : 0.56}
                $tone={lineageTone}
                background="primary"
                border="primary"
                radius="md"
                padding="sm"
              >
                <ClampedText $lines={2} size="xs" bold>
                  {step.title}
                </ClampedText>
              </FlowCard>
            </GraphNodeButton>
          ),
        },
      });
      edges.push({
        id: `${previousNodeId}-${stepNodeId}`,
        source: previousNodeId,
        target: stepNodeId,
        className: lineageClassName,
      });
      previousNodeId = stepNodeId;
      cursorY += stepGap;

      if (step.status === 'running' && activeActivity.length > 0) {
        const activityNodeId = `${stepNodeId}-activity`;
        const latestActivity = activeActivity.at(-1)!;
        nodes.push({
          id: activityNodeId,
          className: 'nopan',
          position: {x, y: cursorY},
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
          data: {
            hypothesisId: hypothesis.id,
            label: (
              <GraphNodeButton
                className="nodrag nopan"
                aria-label={t('View Seer updates for: %s', hypothesis.statement)}
                onPointerDown={event => event.stopPropagation()}
                onClick={() => openHypothesis(hypothesis.id)}
              >
                <FlowCard
                  $opacity={0.82}
                  $tone="neutral"
                  background="primary"
                  border="primary"
                  radius="md"
                  padding="sm"
                >
                  <Stack gap="2xs">
                    <Flex align="center" justify="between" gap="xs">
                      <Text size="xs" bold>
                        {t('Seer updates')}
                      </Text>
                      <Badge variant="info">{formatStatus(latestActivity.status)}</Badge>
                    </Flex>
                    <ClampedText $lines={2} size="xs" variant="muted">
                      {latestActivity.title}
                    </ClampedText>
                  </Stack>
                </FlowCard>
              </GraphNodeButton>
            ),
          },
        });
        edges.push({
          id: `${previousNodeId}-${activityNodeId}`,
          source: previousNodeId,
          target: activityNodeId,
          className: lineageClassName,
        });
        previousNodeId = activityNodeId;
        cursorY += activityGap;
      }
    }

    const verdictNodeId = `${hypothesisNodeId}-verdict`;
    nodes.push({
      id: verdictNodeId,
      className: 'nopan',
      position: {x, y: cursorY},
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: {
        hypothesisId: hypothesis.id,
        label: (
          <GraphNodeButton
            className="nodrag nopan"
            aria-label={t('View verdict: %s', hypothesis.statement)}
            onPointerDown={event => event.stopPropagation()}
            onClick={() => openHypothesis(hypothesis.id)}
          >
            <FlowCard
              $opacity={lineageSupported ? 1 : 0.68}
              $tone={lineageTone}
              background="primary"
              border="primary"
              radius="md"
              padding="sm"
            >
              <Flex align="center" justify="between" gap="xs">
                <Text size="sm" bold>
                  {t('Agent verdict')}
                </Text>
                <Badge variant={lineageSupported ? 'success' : 'muted'}>
                  {getHypothesisStatusLabel(hypothesis)}
                </Badge>
              </Flex>
            </FlowCard>
          </GraphNodeButton>
        ),
      },
    });
    edges.push({
      id: `${previousNodeId}-${verdictNodeId}`,
      source: previousNodeId,
      target: verdictNodeId,
      className: lineageClassName,
    });
    laneBottoms.push(cursorY);
  }

  const graphKey = nodes.map(node => node.id).join('|');
  return (
    <GraphCanvas
      key={graphKey}
      data-hypothesis-count={hypotheses.length}
      data-test-id="investigation-hypothesis-graph"
      style={{height: Math.max(340, Math.max(...laneBottoms, 240) + 110)}}
    >
      <ReactFlow
        aria-label={t('Investigation hypotheses')}
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{padding: 0.08}}
        minZoom={0.45}
        maxZoom={1.25}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
        selectionOnDrag={false}
        zoomOnDoubleClick={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} />
      </ReactFlow>
    </GraphCanvas>
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
  const {openModal} = useModal();
  const decisionTarget = `hypothesis-decision:${hypothesis.id}` as const;
  const decisionPending = commandState?.pendingTarget === decisionTarget;

  const decide = (disposition: 'accepted' | 'rejected') => {
    if (!onCommand || !commandState) {
      return;
    }
    onCommand(
      {
        type: 'set_hypothesis_disposition',
        hypothesisId: hypothesis.id,
        disposition:
          hypothesis.decisionSource === 'user' &&
          hypothesis.effectiveStatus === disposition
            ? null
            : disposition,
      },
      decisionTarget
    );
  };

  const showDetails = () =>
    openModal(deps => (
      <HypothesisDetailModal
        {...deps}
        commandState={commandState}
        hypothesis={hypothesis}
        onCommand={onCommand}
        primary={primary}
      />
    ));

  return (
    <FlowCard
      $opacity={isHypothesisSupported(hypothesis) ? 0.96 : 0.74}
      $tone={isHypothesisSupported(hypothesis) ? 'positive' : 'neutral'}
      role="button"
      tabIndex={0}
      aria-label={t('View hypothesis: %s', hypothesis.statement)}
      border="primary"
      radius="md"
      padding="sm"
      height="100%"
      onClick={showDetails}
      onPointerDown={event => event.stopPropagation()}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          showDetails();
        }
      }}
    >
      <Stack gap="sm" minWidth={0} height="100%">
        <Stack gap="xs" minWidth={0} flex={1}>
          <ClampedText $lines={2} size="sm" bold align="left" wordBreak="break-word">
            {hypothesis.statement}
          </ClampedText>
          <Flex align="center" gap="xs" wrap="wrap">
            <Badge
              role="status"
              aria-live="polite"
              variant={isHypothesisSupported(hypothesis) ? 'success' : 'muted'}
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
        {onCommand && commandState ? (
          <Flex align="center" justify="end" gap="xs">
            <Button
              size="xs"
              variant={
                hypothesis.effectiveStatus === 'accepted' ? 'primary' : 'transparent'
              }
              aria-label={t('Accept hypothesis: %s', hypothesis.statement)}
              busy={decisionPending}
              disabled={commandState.isPending}
              icon={<IconCheckmark />}
              onClick={event => {
                event.stopPropagation();
                decide('accepted');
              }}
            />
            <Button
              size="xs"
              variant={
                hypothesis.effectiveStatus === 'rejected' ? 'danger' : 'transparent'
              }
              aria-label={t('Reject hypothesis: %s', hypothesis.statement)}
              disabled={commandState.isPending}
              icon={<IconClose />}
              onClick={event => {
                event.stopPropagation();
                decide('rejected');
              }}
            />
          </Flex>
        ) : null}
        {commandState ? (
          <CommandFeedback commandState={commandState} targets={[decisionTarget]} />
        ) : null}
      </Stack>
    </FlowCard>
  );
}

function HypothesisDetailModal({
  Body,
  Footer,
  Header,
  closeModal,
  commandState,
  hypothesis,
  onCommand,
  primary,
}: ModalRenderProps & {
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
    <Fragment>
      <Header closeButton>
        <Stack gap="xs">
          <Text bold>{hypothesis.statement}</Text>
          <Flex align="center" gap="xs" wrap="wrap">
            <Badge variant={getStatusVariant(hypothesis.effectiveStatus)}>
              {getHypothesisStatusLabel(hypothesis)}
            </Badge>
            {primary ? <Badge variant="info">{t('Primary')}</Badge> : null}
          </Flex>
        </Stack>
      </Header>
      <Body>
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
          <ToolActivityDisclosure activity={hypothesis.toolActivity ?? []} />
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
          {onCommand &&
          commandState &&
          ['failed', 'stalled', 'reauth_required'].includes(hypothesis.status) ? (
            <Button
              size="sm"
              busy={commandState.pendingTarget === `hypothesis-decision:${hypothesis.id}`}
              disabled={commandState.isPending}
              onClick={() =>
                onCommand(
                  {type: 'retry', target: 'hypothesis', targetId: hypothesis.id},
                  `hypothesis-decision:${hypothesis.id}`
                )
              }
            >
              {t('Retry hypothesis')}
            </Button>
          ) : null}
        </Stack>
      </Body>
      <Footer>
        <Button onClick={closeModal}>{t('Done')}</Button>
      </Footer>
    </Fragment>
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
  const steps = activity.filter(item => item.kind === 'step');
  const toolCalls = activity.filter(item => item.kind !== 'step');
  return (
    <Stack gap="sm">
      {steps.length > 0 ? (
        <ActivityList
          title={t('Investigation steps')}
          activity={steps}
          showKind={false}
        />
      ) : null}
      {toolCalls.length > 0 ? (
        <ActivityList title={t('Tool activity')} activity={toolCalls} showKind />
      ) : null}
    </Stack>
  );
}

function ToolActivityDisclosure({activity}: {activity: InvestigationToolActivity[]}) {
  if (activity.length === 0) {
    return null;
  }
  const latest = getActiveToolActivity(activity).at(-1) ?? activity.at(-1)!;
  return (
    <Disclosure size="sm" variant="outline">
      <Disclosure.Title
        trailingItems={
          <Badge variant={getStatusVariant(latest.status)}>
            {formatStatus(latest.status)}
          </Badge>
        }
      >
        {t('Seer updates')}
      </Disclosure.Title>
      <Disclosure.Content>
        <ToolActivityList activity={activity} />
      </Disclosure.Content>
    </Disclosure>
  );
}

function AgentUpdates({
  activity,
  emptyLabel,
}: {
  activity: InvestigationToolActivity[];
  emptyLabel: string;
}) {
  if (activity.length === 0) {
    return (
      <Text role="status" aria-live="polite" size="sm" variant="muted">
        {emptyLabel}
      </Text>
    );
  }
  const active = getActiveToolActivity(activity);
  const latest = active.at(-1) ?? activity.at(-1)!;
  return (
    <Stack gap="xs" role="status" aria-live="polite" data-test-id="seer-updates">
      <Flex align="center" gap="sm" minWidth={0}>
        <Badge variant={getStatusVariant(latest.status)}>
          {formatStatus(latest.status)}
        </Badge>
        <Text size="sm" wordBreak="break-word">
          {latest.title}
        </Text>
      </Flex>
      <ToolActivityDisclosure activity={activity} />
    </Stack>
  );
}

function ReportCompositionUpdates({
  orchestration,
}: {
  orchestration: InvestigationOrchestration;
}) {
  const report = orchestration.report;
  const liveToolActivity = report.currentBlockToolActivity ?? [];
  const metadataActive =
    orchestration.phase === 'metadata' && report.metadata.status !== 'completed';
  const currentTitle = report.currentBlockKey
    ? humanizeStableKey(report.currentBlockKey)
    : metadataActive
      ? t('Finalizing the title and summary')
      : t('Planning the evidence and narrative');
  const status = report.currentBlockStatus ?? (metadataActive ? 'running' : 'queued');
  const activity: InvestigationToolActivity[] = [
    {
      id: report.currentBlockKey ?? 'report-composition',
      kind: 'step',
      status,
      title: currentTitle,
    },
    ...liveToolActivity,
  ];

  return (
    <Container as="section" data-test-id="report-composition-updates">
      <AgentUpdates activity={activity} emptyLabel={t('Building the investigation…')} />
    </Container>
  );
}

function ActivityList({
  activity,
  showKind,
  title,
}: {
  activity: InvestigationToolActivity[];
  showKind: boolean;
  title: string;
}) {
  return (
    <Stack gap="xs">
      <Heading as="h4" size="sm">
        {title}
      </Heading>
      <Stack role="list" aria-label={title} gap="xs">
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
              {showKind ? <Badge variant="muted">{formatStatus(item.kind)}</Badge> : null}
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

function InvestigationComposer({
  commandState,
  mode,
  onCommand,
}: {
  commandState: OrchestrationCommandState;
  mode: 'intake' | 'steer';
  onCommand: (
    command: InvestigationOrchestrationCommand,
    target: OrchestrationCommandTarget
  ) => void;
}) {
  const [value, setValue] = useState('');
  const target = mode === 'intake' ? 'input' : 'workflow';
  const submit = () => {
    const instruction = value.trim();
    if (!instruction || commandState.isPending) {
      return;
    }
    onCommand(
      mode === 'intake'
        ? {type: 'provide_input', prompt: instruction}
        : {type: 'steer', target: 'workflow', instruction},
      target
    );
    setValue('');
  };

  return (
    <ComposerForm
      onSubmit={event => {
        event.preventDefault();
        submit();
      }}
    >
      <Flex align="end" gap="sm">
        <TextArea
          aria-label={
            mode === 'intake'
              ? t('What should Seer investigate?')
              : t('Steer the investigation')
          }
          autosize
          rows={2}
          placeholder={
            mode === 'intake'
              ? t('What should Seer investigate?')
              : t('Ask Seer to change direction, test a theory, or update the report…')
          }
          value={value}
          onChange={event => setValue(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Button
          type="submit"
          variant="primary"
          aria-label={
            mode === 'intake' ? t('Start investigation') : t('Send instructions')
          }
          busy={commandState.pendingTarget === target}
          disabled={!value.trim() || commandState.isPending}
          icon={<IconArrow direction="right" />}
        />
      </Flex>
      <CommandFeedback commandState={commandState} targets={[target]} />
    </ComposerForm>
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

function isWorkInProgress(status: string) {
  return ['queued', 'running'].includes(status);
}

function getActiveToolActivity(activity: InvestigationToolActivity[]) {
  return activity.filter(item => ['queued', 'running'].includes(item.status));
}

function humanizeStableKey(stableKey: string) {
  return stableKey
    .replaceAll(/[-_]+/g, ' ')
    .replace(/^./, character => character.toUpperCase());
}

function isReportCompositionActive(orchestration: InvestigationOrchestration) {
  return (
    orchestration.report.status === 'composing' ||
    (orchestration.phase === 'metadata' &&
      orchestration.report.metadata.status !== 'completed')
  );
}

function isHypothesisSupported(hypothesis: InvestigationHypothesis) {
  return ['supported', 'accepted'].includes(hypothesis.effectiveStatus);
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
