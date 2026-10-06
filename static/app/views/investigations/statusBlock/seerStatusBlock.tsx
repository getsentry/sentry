import type {ReactNode} from 'react';

import {ToolCall, ToolCallIndicator, type ToolCallStatus} from '@sentry/scraps/chat';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  IconCircleCheckmark,
  IconCircleDashed,
  IconFatal,
  IconSeer,
  IconWarning,
} from 'sentry/icons';
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
 * The shared chat glyph for each tool-call status, so a call here reads the same
 * as it does in the Seer agent. A status Seer adds before this code knows the
 * name is shown as waiting: the call exists but nothing has come of it yet.
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
 * What the latest call's bare glyph announces. Without a label the shared
 * indicator falls back to describing a pending call as waiting for approval,
 * which is not what a queued call means here.
 */
function getToolCallLabel(status: InvestigationToolActivity['status']): string {
  switch (status) {
    case 'queued':
      return t('Queued');
    case 'running':
      return t('Running');
    case 'completed':
      return t('Succeeded');
    case 'failed':
      return t('Failed');
    default:
      return t('Waiting');
  }
}

/**
 * The calls behind the current phase, drawn the way the Seer agent draws them.
 *
 * Only the latest is shown: it says what the agent is doing right now, and the
 * block's title is still the sentence to read. When there is history behind it,
 * the latest call becomes the toggle, and opening it lists the earlier calls
 * newest first, so the list reads back in time from what is happening now.
 */
function ToolActivityList({toolActivity}: {toolActivity: InvestigationToolActivity[]}) {
  const latest = toolActivity[toolActivity.length - 1];
  if (!latest) {
    return null;
  }
  const earlier = toolActivity.slice(0, -1).reverse();

  if (!earlier.length) {
    return (
      <Container data-test-id="seer-status-block-tool-activity">
        <ToolCall title={latest.title} status={getToolCallStatus(latest.status)} />
      </Container>
    );
  }

  return (
    <Container data-test-id="seer-status-block-tool-activity">
      <Disclosure size="xs">
        <Disclosure.Title
          leadingItems={
            <ToolCallIndicator
              status={getToolCallStatus(latest.status)}
              aria-label={getToolCallLabel(latest.status)}
            />
          }
        >
          <Text size="sm" variant="secondary" monospace ellipsis>
            {latest.title}
          </Text>
        </Disclosure.Title>
        <Disclosure.Content>
          <Stack
            as="ul"
            gap="xs"
            margin="0"
            padding="0"
            aria-label={t('Earlier tool calls')}
          >
            {earlier.map(activity => (
              <Flex as="li" key={activity.id} minWidth="0">
                <ToolCall
                  title={activity.title}
                  status={getToolCallStatus(activity.status)}
                />
              </Flex>
            ))}
          </Stack>
        </Disclosure.Content>
      </Disclosure>
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
   * How long the run has been going, already formatted (e.g. "101.5s"). Left
   * out when there is nothing to measure from: the projection carries no
   * run-level start time, so the wired block omits this rather than invent one.
   */
  elapsed?: string;
  /**
   * A tally between the title and the description, e.g.
   * "4 possible causes · 9 checks completed". Only worth showing once there is
   * something to count.
   */
  meta?: string;
  /**
   * The tool calls behind the current phase, latest last. Only the latest is
   * shown; it expands to list the earlier ones. Only a running block should supply
   * these — once a run stops they are history, not status.
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

            {toolActivity?.length ? (
              <ToolActivityList toolActivity={toolActivity} />
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
