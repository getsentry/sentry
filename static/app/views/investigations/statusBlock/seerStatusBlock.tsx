import type {ReactNode} from 'react';
import {IconCircleCheckmark} from '@sentry/icons/circleCheckmark';
import {IconCircleDashed} from '@sentry/icons/circleDashed';
import {IconFatal} from '@sentry/icons/fatal';
import {IconSeer} from '@sentry/icons/seer';
import {IconWarning} from '@sentry/icons/warning';

import {Disclosure} from '@sentry/scraps/disclosure';
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

function ToolCallTitle({activity}: {activity: InvestigationToolActivity}) {
  return (
    <Flex as="span" align="baseline" gap="sm" minWidth="0">
      <Text size="sm" variant="secondary" density="fixed" monospace ellipsis>
        {activity.title}
      </Text>
      {activity.status === 'failed' ? (
        <Text size="sm" variant="danger" density="fixed" wrap="nowrap">
          {t('Failed')}
        </Text>
      ) : null}
    </Flex>
  );
}

/**
 * The calls behind the current phase.
 *
 * Only the latest is shown: it says what the agent is doing right now, and the
 * block's title is still the sentence to read. When there is history behind it,
 * the latest call becomes the `Disclosure` toggle, and opening it lists the
 * earlier calls newest first, so the list reads back in time from what is
 * happening now.
 *
 * The calls carry no running or done glyph. The block's own icon already says
 * the run is working, and a second spinner beside it would show two loading
 * states in one place.
 *
 * Each call sits in a row as tall as an `xs` disclosure title (a 16px line with
 * 6px above and below), whether or not it can be expanded. The block's lines
 * are spaced to match that row, so the gaps between title, description and
 * tool call read the same.
 */
function ToolActivityList({toolActivity}: {toolActivity: InvestigationToolActivity[]}) {
  const latest = toolActivity[toolActivity.length - 1];
  if (!latest) {
    return null;
  }
  const earlier = toolActivity.slice(0, -1).reverse();

  if (!earlier.length) {
    return (
      <Flex
        data-test-id="seer-status-block-tool-activity"
        minWidth="0"
        paddingTop="sm"
        paddingBottom="sm"
        paddingLeft="lg"
      >
        <ToolCallTitle activity={latest} />
      </Flex>
    );
  }

  return (
    <Container data-test-id="seer-status-block-tool-activity" minWidth="0">
      <Disclosure size="xs">
        <Disclosure.Title>
          <ToolCallTitle activity={latest} />
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
                <ToolCallTitle activity={activity} />
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
            {/*
             * A tool call row carries 6px of its own above its text, so it sits
             * `2xs` below the description and the text lines sit `md` apart:
             * either way, 8px between one line of text and the next.
             */}
            <Stack gap="2xs" minWidth="0">
              <Stack gap="md" minWidth="0">
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
              </Stack>

              {toolActivity?.length ? (
                <ToolActivityList toolActivity={toolActivity} />
              ) : null}
            </Stack>

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
