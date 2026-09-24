import {Fragment, type MouseEvent, type ReactNode} from 'react';
import type {LocationDescriptor} from 'history';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {useTranslation} from '@sentry/scraps/translationContext';

import {IconSpan} from 'sentry/icons';
import {unreachable} from 'sentry/utils/unreachable';

import {ClippedDetail} from './clippedDetail';
import {ToolCallIndicator, type ToolCallStatus} from './toolCallIndicator';

/**
 * An inline link referencing an entity a tool call produced or acted on (e.g.
 * `Trace: a3805648`). Renders as a real link when given `to`, an interactive
 * button when given `onClick`, or non-interactive text otherwise.
 */
export interface ToolCallReference {
  /**
   * The referenced identifier, emphasized in the link (e.g. a trace or span id).
   */
  value: string;
  /**
   * Leading glyph. Defaults to `IconSpan`.
   */
  icon?: ReactNode;
  /**
   * A short type label shown before the value (e.g. `Trace`, `Span`).
   */
  label?: string;
  /**
   * Fires when the reference is activated. When omitted (and no `to` is set) the
   * reference is still rendered but non-interactive. Receives the event so callers can stop
   * propagation or record analytics; pair it with `to` to track a navigation.
   */
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  /**
   * Navigation target. When set, the reference renders as a real link (anchor) so it
   * supports middle/cmd-click and keyboard access, rather than an `onClick` button.
   */
  to?: LocationDescriptor;
}

interface ToolCallProps {
  /**
   * Lifecycle status. Drives the leading glyph (spinner while running, semantic
   * icon once settled) via `ToolCallIndicator`. A `failure` also surfaces a
   * trailing `Failed` chip in the result area so the outcome reads on the right.
   */
  status: ToolCallStatus;
  /**
   * The tool call's headline (e.g. `Query spans`, `Read trace waterfall`).
   */
  title: string;
  /**
   * Supplementary detail rendered beneath the title — e.g. the request body.
   * Always visible: a nested tool call has no disclosure of its own.
   */
  children?: ReactNode;
  /**
   * The trailing danger chip's text when `status` is `failure` (e.g. the HTTP
   * status code `502`). Defaults to `Failed`.
   */
  failureLabel?: string;
  /**
   * The call's request, rendered under an `Input:` label. Pass a decomposed
   * view (e.g. a `FormattedQuery`) so the request reads as its filters rather
   * than a raw URL string.
   */
  input?: ReactNode;
  /**
   * Short status lines surfaced beneath the call (e.g. "Truncated to 100 rows").
   */
  notifications?: string[];
  /**
   * The call's result, rendered under an `Output:` label — a result value, or on
   * failure the error itself. A slot, mirroring `input`.
   */
  output?: ReactNode;
  /**
   * A link flowing inline after the title text. Typically the entity the call
   * acted on — the call's result.
   */
  reference?: ToolCallReference;
}

// The leading status glyph and the indent of every row beneath the title are
// pinned to this width so detail (input chips, notifications, children) aligns
// under the headline rather than under the glyph.
const GLYPH_SLOT_WIDTH = '16px';

// `inherit` so the text takes the link button's accent color rather than
// resetting to the default content color.
function ChipContent({label, value}: {value: string; label?: string}) {
  return label ? (
    <Text size="sm" variant="inherit">
      {`${label}: `}
      <Text size="sm" variant="inherit" bold>
        {value}
      </Text>
    </Text>
  ) : (
    <Text size="sm" variant="inherit" bold>
      {value}
    </Text>
  );
}

/**
 * The reference, rendered as a `link`-variant button that flows inline after the
 * title text. A trailing chip in its own non-shrinking column squeezed the title
 * into a narrow, many-line column in tight containers; inline, the title keeps
 * the full width and the link wraps with it as a single unit.
 */
function ReferenceLink({reference}: {reference: ToolCallReference}) {
  const {label, value, icon, onClick, to} = reference;
  // No explicit size: `Button`/`LinkButton` already scale their `icon` via
  // `IconDefaultsProvider`, and a hardcoded size here would fight that when the
  // link's button size ever changes.
  const chipIcon = icon ?? <IconSpan />;
  const content = <ChipContent label={label} value={value} />;

  // A navigation target renders as a real anchor so middle/cmd-click and keyboard access work; an
  // `onClick`-only reference stays a button; one with neither is non-interactive.
  if (to) {
    return (
      <LinkButton size="zero" variant="link" icon={chipIcon} to={to} onClick={onClick}>
        {content}
      </LinkButton>
    );
  }

  return (
    <Button
      size="zero"
      variant="link"
      icon={chipIcon}
      onClick={onClick}
      disabled={!onClick}
    >
      {content}
    </Button>
  );
}

/**
 * The hoisted failure marker. A failed call keeps its leading glyph but also
 * surfaces this danger chip in the trailing result slot, so the outcome is
 * legible on the right rather than
 * only as a small glyph on the far left. The `label` is typically the HTTP status
 * code (e.g. `502`).
 */
function FailureChip({label}: {label: ReactNode}) {
  return (
    <Container
      border="danger"
      radius="sm"
      paddingLeft="sm"
      paddingRight="sm"
      background="primary"
    >
      <Text size="sm" variant="danger" bold>
        {label}
      </Text>
    </Container>
  );
}

function InputBox({input}: {input: ReactNode}) {
  const {t} = useTranslation();
  return (
    <Container
      background="secondary"
      border="primary"
      radius="md"
      padding="sm"
      width="100%"
    >
      <Flex align="center" gap="sm" wrap="wrap">
        <Text size="sm" variant="secondary" monospace bold>
          {t('Input:')}
        </Text>
        <ClippedDetail>{input}</ClippedDetail>
      </Flex>
    </Container>
  );
}

function OutputBox({output}: {output: ReactNode}) {
  const {t} = useTranslation();
  return (
    <Container background="secondary" radius="md" padding="sm" width="100%">
      <Flex align="center" gap="sm" wrap="wrap">
        <Text size="sm" variant="secondary" monospace bold>
          {t('Output:')}
        </Text>
        <ClippedDetail>{output}</ClippedDetail>
      </Flex>
    </Container>
  );
}

function getStatusLabel(
  status: ToolCallStatus,
  t: (text: string) => string
): string | undefined {
  switch (status) {
    case 'loading':
      return t('Running');
    case 'pending':
      return t('Waiting');
    case 'success':
      return t('Succeeded');
    case 'failure':
      return t('Failed');
    case 'mixed':
      return t('Partially succeeded');
    case 'content':
      return undefined;
    default:
      return unreachable(status);
  }
}

/**
 * A single agent tool call within a `ThinkingBlock`.
 *
 * Unlike the collapsible `ThinkingBlock` it lives in, a tool call is not itself a
 * disclosure — its detail is always visible. The lifecycle glyph
 * (`ToolCallIndicator`) leads the title; an optional `reference` link follows the
 * title text inline and, on failure, a `failureLabel` chip (the HTTP status)
 * trails the row. `input`, `output`,
 * `notifications`, and `children` stack beneath the title, indented to align
 * under the headline.
 */
export function ToolCall({
  title,
  status,
  failureLabel,
  input,
  output,
  reference,
  notifications,
  children,
}: ToolCallProps) {
  const {t} = useTranslation();
  const isFailure = status === 'failure';
  const hasDetail =
    Boolean(input) ||
    Boolean(output) ||
    Boolean(notifications?.length) ||
    Boolean(children);

  return (
    <Stack gap="xs" flex={1} minWidth={0} width="100%">
      <Flex gap="md" align="center" width="100%">
        <Flex width={GLYPH_SLOT_WIDTH} justify="center" flexShrink={0}>
          <ToolCallIndicator status={status} aria-label={getStatusLabel(status, t)} />
        </Flex>
        <Flex flex={1} minWidth={0} align="center" justify="between" gap="md">
          <Text size="sm" variant="secondary" monospace wordBreak="break-word">
            {title}
            {reference ? (
              <Fragment>
                {' '}
                <ReferenceLink reference={reference} />
              </Fragment>
            ) : null}
          </Text>
          {isFailure ? (
            <Flex flexShrink={0}>
              <FailureChip label={failureLabel ?? t('Failed')} />
            </Flex>
          ) : null}
        </Flex>
      </Flex>

      {hasDetail ? (
        <Flex gap="md" align="start" width="100%">
          <Flex width={GLYPH_SLOT_WIDTH} flexShrink={0} aria-hidden />
          <Stack gap="xs" flex={1} minWidth={0}>
            {input ? <InputBox input={input} /> : null}
            {output ? <OutputBox output={output} /> : null}
            {notifications?.map((note, i) => (
              <Text key={i} size="sm" variant="muted">
                {note}
              </Text>
            ))}
            {children}
          </Stack>
        </Flex>
      ) : null}
    </Stack>
  );
}
