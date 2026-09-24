import {Fragment, type MouseEvent, type ReactNode} from 'react';
import styled from '@emotion/styled';
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
   * A link at the right edge of the title line, or inline after the title text in
   * a narrow container. Typically the entity the call
   * acted on — the call's result.
   */
  reference?: ToolCallReference;
}

// The leading status glyph and the indent of every row beneath the title are
// pinned to this width so detail (input chips, notifications, children) aligns
// under the headline rather than under the glyph.
const GLYPH_SLOT_WIDTH = '16px';

// Holds the status glyph. One title line tall (at the title's font size), so the
// glyph centers on the first line of a wrapped title instead of the whole block.
// Styled because `1lh` needs the title's font size, which no layout primitive sets.
const GlyphSlot = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: ${GLYPH_SLOT_WIDTH};
  height: 1lh;
  font-size: ${p => p.theme.font.size.sm};
`;

// The title and its reference. In a narrow container this is a block, so the
// reference flows inline right after the title text and wraps with it. From the
// `sm` container width up it becomes a row, pushing the reference to the right
// edge, pinned to the title's first line. The font size matches the title so
// `1lh` measures one title line. Styled because `Flex` can't be `display: block`
// below the breakpoint, which the inline flow needs.
const TitleLine = styled('div')`
  flex: 1;
  min-width: 0;
  font-size: ${p => p.theme.font.size.sm};

  @container (min-width: ${p => p.theme.container.sm}) {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: ${p => p.theme.space.md};
  }
`;

// The reference button is `inline-flex`, whose baseline is its first item's —
// the icon's bottom edge — so on the title's baseline it rides a few pixels
// high, and `vertical-align: middle` (baseline + half x-height) overshoots low.
// Instead, make the wrapper exactly one line tall, pin it to the top of the
// line box, and center the button inside it. No layout primitive exposes
// `vertical-align`, hence the styled wrapper.
const InlineReference = styled('span')`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  height: 1lh;
  vertical-align: top;
`;

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
 * The reference, rendered as a `link`-variant button. `TitleLine` places it: at
 * the right edge in wide containers, inline after the title text in narrow ones.
 * A trailing column in a narrow container squeezed the title into many short
 * lines; inline, the title keeps the full width and the link wraps with it.
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
 * (`ToolCallIndicator`) leads the title, level with its first line; an optional
 * `reference` link sits at the right edge (or inline after the title text in a
 * narrow container) and, on failure, a `failureLabel` chip (the HTTP status)
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
    <Stack gap="xs" flex={1} minWidth={0} width="100%" containerType="inline-size">
      <Flex gap="md" align="start" width="100%">
        <GlyphSlot>
          <ToolCallIndicator status={status} aria-label={getStatusLabel(status, t)} />
        </GlyphSlot>
        <Flex flex={1} minWidth={0} align="start" justify="between" gap="md">
          <TitleLine>
            <Text size="sm" variant="secondary" monospace wordBreak="break-word">
              {title}
            </Text>
            {reference ? (
              <Fragment>
                {' '}
                <InlineReference>
                  <ReferenceLink reference={reference} />
                </InlineReference>
              </Fragment>
            ) : null}
          </TitleLine>
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
