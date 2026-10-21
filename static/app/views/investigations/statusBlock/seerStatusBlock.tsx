import {useState, type ReactNode} from 'react';
import {IconCircleCheckmark} from '@sentry/icons/circleCheckmark';
import {IconCircleDashed} from '@sentry/icons/circleDashed';
import {IconFatal} from '@sentry/icons/fatal';
import {IconSeer} from '@sentry/icons/seer';
import {IconWarning} from '@sentry/icons/warning';

import {
  MessageRow,
  ThinkingBlock,
  ToolCall,
  type ToolCallStatus,
} from '@sentry/scraps/chat';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {InvestigationToolActivity} from 'sentry/views/investigations/types';

/**
 * Where an agentic run has got to, as one line the viewer can read without
 * opening anything.
 *
 * `running` covers every phase the agent moves through on its own — gathering
 * context, forming hypotheses, checking evidence, composing the report. They
 * differ in what they *say*, not in how they look, so they share one variant
 * and the caller supplies the sentence.
 *
 * The other three have all stopped. `awaitingInput` has stopped recoverably and
 * is the only one that asks for something back, which is why it is the only one
 * that renders an action.
 */
export type SeerStatusBlockVariant =
  | 'running'
  | 'awaitingInput'
  | 'failed'
  | 'complete'
  // Not one of the designed states. A cancelled run still has to render, and
  // falling through to `failed` would report a decision someone made as an
  // error, so it gets the neutral treatment instead of a red one.
  | 'cancelled';

/**
 * Only a state that has stopped and needs attention colours its title. A run
 * that is simply working, or has finished cleanly, leaves the sentence in the
 * ordinary heading colour and lets the header badge carry the state — otherwise every
 * status block on the page shouts.
 */
const TITLE_VARIANT = {
  running: undefined,
  awaitingInput: 'warning',
  failed: 'danger',
  complete: undefined,
  cancelled: 'muted',
} as const;

function StatusIcon({variant}: {variant: SeerStatusBlockVariant}) {
  switch (variant) {
    case 'running':
      // The same spinning Seer the agent's thinking block shows while it works,
      // so a running investigation reads as Seer at work wherever it appears.
      return <IconSeer size="sm" animation="loading" />;
    case 'awaitingInput':
      return <IconWarning size="sm" variant="warning" />;
    case 'failed':
      return <IconFatal size="sm" variant="danger" />;
    case 'complete':
      return <IconCircleCheckmark size="sm" variant="success" />;
    // A stopped run that is nobody's problem. A dashed ring reads as "this one
    // is not going anywhere" without claiming anything went wrong.
    case 'cancelled':
      return <IconCircleDashed size="sm" variant="muted" />;
    default:
      return null;
  }
}

/**
 * An investigation call's status in the chat's tool-call vocabulary, so it gets
 * the same glyph and label as a call in the Seer agent. The agent works its
 * statuses out from its own blocks and call records, so this projection's
 * statuses have no other mapping to reuse. A queued call, or a status Seer adds
 * before this code knows the name, is shown as waiting: the call exists but
 * nothing has come of it yet.
 */
function getToolCallStatus(status: InvestigationToolActivity['status']): ToolCallStatus {
  switch (status) {
    case 'running':
      return 'loading';
    case 'completed':
      return 'success';
    case 'failed':
      return 'failure';
    default:
      return 'pending';
  }
}

/**
 * What the agent is doing, drawn as the Seer agent's own thinking block: the
 * latest call is the live title, every call behind the current phase is listed
 * inside in the order it ran, and the run's clock sits on the right. It opens
 * while the run works, as the agent's does, and the viewer can fold it away.
 *
 * Before any call has landed the title is "Thinking", as the agent's is before
 * its first tool runs, so the block holds its place through phases that make no
 * calls instead of appearing and disappearing between them.
 */
function SeerThinking({
  startTime,
  toolActivity,
}: {
  startTime?: Date;
  toolActivity?: InvestigationToolActivity[];
}) {
  // Without the run's own start, the clock counts from when the block appeared,
  // as the agent's does for a response that has only just begun.
  const [appearedAt] = useState(() => new Date());
  const latest = toolActivity?.[toolActivity.length - 1];

  return (
    <Container data-test-id="seer-status-block-thinking">
      <ThinkingBlock
        title={latest?.title ?? t('Thinking')}
        startTime={startTime ?? appearedAt}
      >
        {toolActivity?.length
          ? toolActivity.map(activity => (
              <MessageRow key={activity.id} from="assistant" density="compact">
                <ToolCall
                  title={activity.title}
                  status={getToolCallStatus(activity.status)}
                />
              </MessageRow>
            ))
          : null}
      </ThinkingBlock>
    </Container>
  );
}

type SeerStatusBlockProps = {
  /** The sentence the block leads with, in the agent's voice. */
  title: string;
  variant: SeerStatusBlockVariant;
  /**
   * What the viewer can do about it. Only `awaitingInput` should supply one —
   * every other state is the agent's to advance, and an action would imply
   * otherwise.
   */
  action?: ReactNode;
  /**
   * Content under the description that a plain sentence can't carry, such as
   * the conclusion of a finished investigation.
   */
  children?: ReactNode;
  className?: string;
  /** The paragraph under the title. */
  description?: string;
  /**
   * How long the run has been going, already formatted (e.g. "101.5s"), shown
   * beside the title. The wired block leaves it out: a running block's live
   * clock is in its thinking block (see `startTime`), and the page header
   * carries the run's active time.
   */
  elapsed?: string;
  /**
   * A tally between the title and the description, e.g.
   * "4 possible causes · 9 checks completed". Only worth showing once there is
   * something to count.
   */
  meta?: string;
  /**
   * When the run started working, on this browser's clock. A running block's
   * thinking block counts up from it, so its clock is the run's rather than how
   * long the page has been open. Left out when the projection can't say, and
   * the clock then starts when the block appears.
   */
  startTime?: Date;
  /**
   * The tool calls behind the current phase, latest last. A running block shows
   * them in a thinking block like the Seer agent's, with the latest as its
   * title. Only a running block draws them — once a run stops they are history,
   * not status.
   */
  toolActivity?: InvestigationToolActivity[];
  /**
   * A control on the right edge of the block, such as a link to open the
   * investigation. Unlike `action`, it is not a request for input.
   */
  trailing?: ReactNode;
};

/**
 * The status line above an agentic investigation's hypotheses.
 *
 * One component covers the whole run lifecycle because the shape never changes
 * — icon, sentence, elapsed time — only the words and the colour do. That
 * is deliberate: the block sits in a fixed spot above the hypotheses panel, and a
 * reader who has learned where to look for "what is Seer doing" should not have
 * to relearn it when the run changes state.
 *
 * It is presentational and knows nothing about the projection, so it can be
 * driven from a story, a fixture, or the live run.
 */
export function SeerStatusBlock({
  action,
  children,
  className,
  description,
  elapsed,
  meta,
  startTime,
  title,
  toolActivity,
  trailing,
  variant,
}: SeerStatusBlockProps) {
  return (
    <Container
      className={className}
      border="primary"
      radius="md"
      background="primary"
      padding="lg"
      data-test-id="seer-status-block"
      data-variant={variant}
    >
      {/*
       * The content and the trailing control centre against each other, so a
       * one-line status sits level with a button taller than it.
       */}
      <Flex gap="md" align="center">
        <Flex gap="md" align="start" flex="1 1 auto" minWidth="0">
          {/*
           * A fixed column so the title, the description and the action all line
           * up on the same left edge regardless of which icon is showing. `16px`
           * is the title's line height, which centres the icon against the first
           * line rather than the block.
           */}
          <Flex height="16px" align="center" justify="center" flex="0 0 auto">
            <StatusIcon variant={variant} />
          </Flex>

          <Stack gap="xs" flex="1 1 auto" minWidth="0">
            <Flex justify="between" align="center" gap="md">
              <Text size="md" bold variant={TITLE_VARIANT[variant]}>
                {title}
              </Text>
              {elapsed ? (
                <Text size="sm" variant="muted" monospace tabular wrap="nowrap">
                  {elapsed}
                </Text>
              ) : null}
            </Flex>

            {meta ? (
              <Text size="sm" variant="muted">
                {meta}
              </Text>
            ) : null}

            {description ? (
              <Text size="sm" density="comfortable">
                {description}
              </Text>
            ) : null}

            {variant === 'running' ? (
              <SeerThinking startTime={startTime} toolActivity={toolActivity} />
            ) : null}

            {children}

            {action ? (
              <Container
                background="secondary"
                radius="md"
                padding="lg"

                data-test-id="seer-status-block-action"
              >
                {action}
              </Container>
            ) : null}
          </Stack>
        </Flex>

        {trailing ? <Flex flex="0 0 auto">{trailing}</Flex> : null}
      </Flex>
    </Container>
  );
}
