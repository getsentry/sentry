import {useState} from 'react';
import styled from '@emotion/styled';

import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Duration} from 'sentry/components/duration';
import {
  IconCheckmark,
  IconCircle,
  IconClose,
  IconSeer,
  IconWarning,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {
  InvestigationCurrentState,
  InvestigationStep,
} from 'sentry/views/investigations/detail/presentationModel';
import {InvestigationSummaryCard} from 'sentry/views/investigations/investigationSummaryCard';

type InvestigationCurrentStateCardProps = {
  state: InvestigationCurrentState;
  className?: string;
};

export function InvestigationCurrentStateCard({
  className,
  state,
}: InvestigationCurrentStateCardProps) {
  const [expanded, setExpanded] = useState(false);

  const completed = state.phase === 'completed';
  const showCurrentUnderstanding =
    state.hasCurrentUnderstanding &&
    (state.phase === 'investigating' || state.phase === 'completed');
  return (
    <InvestigationSummaryCard
      className={className}
      label={completed ? t('Investigation completed') : null}
      labelIcon={completed ? <IconSeer size="sm" /> : null}
      summary={showCurrentUnderstanding ? state.title : null}
      summaryDescription={showCurrentUnderstanding ? state.description : null}
      suggestedNextSteps={showCurrentUnderstanding ? state.suggestedNextSteps : null}
      header={completed ? null : (
        <InvestigationStatusDisclosure
          expanded={expanded}
          state={state}
          onExpandedChange={setExpanded}
        />
      )}
    />
  );
}

function InvestigationStatusDisclosure({
  expanded,
  onExpandedChange,
  state,
}: {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  state: InvestigationCurrentState;
}) {
  const statusLabel = getStatusLabel(state);
  const statusDescription = getStatusDescription(state);

  return (
    <StatusDisclosure
      size="sm"
      expanded={expanded}
      onExpandedChange={onExpandedChange}
      data-test-id="investigation-status-disclosure"
    >
      <Disclosure.Title leadingItems={<StatusIcon phase={state.phase} />}>
        <Flex align="center" gap="xs" wrap="wrap">
          <Text size="sm" monospace bold>
            {statusLabel}
          </Text>
          {statusDescription ? (
            <Text size="sm" monospace variant="muted">
              · {statusDescription}
            </Text>
          ) : null}
        </Flex>
      </Disclosure.Title>
      <Disclosure.Content>
        <Stack gap="xl" data-test-id="investigation-status-steps">
          {state.steps.length > 0 ? (
            state.steps.map(step => <InvestigationStepRow key={step.id} step={step} />)
          ) : (
            <Text size="sm" variant="muted">
              {t('No analysis steps yet.')}
            </Text>
          )}
        </Stack>
      </Disclosure.Content>
    </StatusDisclosure>
  );
}

function InvestigationStepRow({step}: {step: InvestigationStep}) {
  const statusDetail = step.error
    ? t('Error: %s', step.error)
    : step.status === 'blocked'
      ? t('Blocked by an earlier step')
      : null;

  return (
    <Flex align="center" justify="between" gap="md" width="100%" wrap="wrap">
      <Flex align="center" gap="sm" minWidth={0}>
        <StepIcon status={step.status} />
        <Text
          size="sm"
          monospace
          variant={getStepTextVariant(step.status)}
        >
          {step.title}
        </Text>
      </Flex>
      <Flex align="center" gap="sm" wrap="wrap">
        {statusDetail ? (
          <Text
            size="sm"
            monospace
            variant={step.status === 'failed' ? 'danger' : 'muted'}
          >
            {statusDetail}
          </Text>
        ) : null}
        {step.durationMs === null ? null : (
          <Container flexShrink={0}>
            <Text size="sm" monospace variant="muted">
              <Duration
                seconds={step.durationMs / 1000}
                fixedDigits={1}
                abbreviation
              />
            </Text>
          </Container>
        )}
      </Flex>
    </Flex>
  );
}

function getStepTextVariant(status: InvestigationStep['status']) {
  if (status === 'failed') {
    return 'danger';
  }
  if (status === 'completed' || status === 'blocked' || status === 'cancelled') {
    return 'muted';
  }
  return 'primary';
}

const StatusDisclosure = styled(Disclosure)`
  && > * + * {
    padding: ${p => p.theme.space.lg} ${p => p.theme.space.lg} 0;
  }
`;

function StatusIcon({phase}: {phase: InvestigationCurrentState['phase']}) {
  if (phase === 'stopped') {
    return <IconWarning size="sm" variant="danger" aria-label={t('Stopped')} />;
  }
  if (phase === 'archived') {
    return <IconSeer size="sm" variant="muted" aria-label={t('Archived')} />;
  }
  return (
    <IconSeer
      size="sm"
      animation="waiting"
      aria-label={t('Investigating')}
    />
  );
}

function StepIcon({status}: {status: InvestigationStep['status']}) {
  if (status === 'completed') {
    return <IconCheckmark size="md" variant="success" aria-label={t('Completed')} />;
  }
  if (status === 'failed') {
    return <IconClose size="md" variant="danger" aria-label={t('Failed')} />;
  }
  if (status === 'cancelled') {
    return <IconClose size="md" variant="warning" aria-label={t('Cancelled')} />;
  }
  if (status === 'blocked') {
    return <IconWarning size="md" variant="muted" aria-label={t('Blocked')} />;
  }
  if (status === 'running') {
    return <IconSeer size="md" animation="waiting" aria-label={t('Running')} />;
  }
  return <IconCircle size="md" variant="muted" aria-label={t('Queued')} />;
}

function getStatusLabel(state: InvestigationCurrentState) {
  if (state.phase === 'stopped') {
    return t('Investigation stopped');
  }
  if (state.phase === 'archived') {
    return t('Investigation archived');
  }
  return t('Investigating');
}

function getStatusDescription(state: InvestigationCurrentState) {
  if (state.phase === 'starting') {
    return t('Investigation often takes a few minutes to finish…');
  }
  if (state.activeStepTitle) {
    return state.activeStepTitle;
  }
  return null;
}
