import type {ReactNode} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {
  IconCircleCheckmark,
  IconCircleDashed,
  IconFatal,
  IconWarning,
} from 'sentry/icons';

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
 * ordinary heading colour and lets the chip carry the state — otherwise every
 * status block on the page shouts.
 */
const TITLE_VARIANT = {
  running: undefined,
  awaitingInput: 'warning',
  failed: 'danger',
  complete: undefined,
  cancelled: 'muted',
} as const;

const TAG_VARIANT = {
  // `info` is the accent-purple pill: `content.accent` on
  // `background.transparent.accent.muted`, which is what the design names.
  running: 'info',
  awaitingInput: 'warning',
  failed: 'danger',
  complete: 'success',
  cancelled: 'muted',
} as const;

function StatusIcon({variant}: {variant: SeerStatusBlockVariant}) {
  switch (variant) {
    case 'running':
      // A ring rather than a pulsing dot: the run is doing something, not
      // sitting in a state.
      return <LoadingIndicator size={14} />;
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

type SeerStatusBlockProps = {
  /** The short pill on the right, e.g. "Running…", "Awaiting input". */
  statusLabel: string;
  /** The sentence the block leads with, in the agent's voice. */
  title: string;
  variant: SeerStatusBlockVariant;
  /**
   * What the viewer can do about it. Only `awaitingInput` should supply one —
   * every other state is the agent's to advance, and an action would imply
   * otherwise.
   */
  action?: ReactNode;
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
};

/**
 * The status line above an agentic investigation's hypotheses.
 *
 * One component covers the whole run lifecycle because the shape never changes
 * — icon, sentence, chip, elapsed time — only the words and the colour do. That
 * is deliberate: the block sits in a fixed spot at the top of the panel, and a
 * reader who has learned where to look for "what is Seer doing" should not have
 * to relearn it when the run changes state.
 *
 * It is presentational and knows nothing about the projection, so it can be
 * driven from a story, a fixture, or the live run.
 */
export function SeerStatusBlock({
  action,
  className,
  description,
  elapsed,
  meta,
  statusLabel,
  title,
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
      <Flex gap="md" align="start">
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
            {/*
             * The chip and the clock never wrap under the sentence: they are
             * the part a viewer glances at, so they hold the top-right corner
             * and the title wraps around them instead.
             */}
            <Flex gap="md" align="center" flex="0 0 auto">
              <Tag variant={TAG_VARIANT[variant]}>{statusLabel}</Tag>
              {elapsed ? (
                // Monospace and tabular so a ticking counter does not shuffle
                // the chip sideways on every update.
                <Text size="sm" variant="muted" monospace tabular>
                  {elapsed}
                </Text>
              ) : null}
            </Flex>
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
    </Container>
  );
}
