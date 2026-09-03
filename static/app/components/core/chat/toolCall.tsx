import type {MouseEvent, ReactNode} from 'react';
import type {LocationDescriptor} from 'history';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {useTranslation} from '@sentry/scraps/translationContext';

import {IconSpan} from 'sentry/icons';
import {unreachable} from 'sentry/utils/unreachable';

import {ToolCallIndicator, type ToolCallStatus} from './toolCallIndicator';

/**
 * A compact chip referencing an entity a tool call produced or acted on (e.g.
 * `Trace: a3805648`). Renders as a real link when given `to`, an interactive
 * button when given `onClick`, or a non-interactive display chip otherwise.
 */
export interface ToolCallReference {
  /**
   * The referenced identifier, emphasized in the chip (e.g. a trace or span id).
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
   * Fires when the chip is activated. When omitted (and no `to` is set) the chip
   * is still rendered but non-interactive. Receives the event so callers can stop
   * propagation or record analytics; pair it with `to` to track a navigation.
   */
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  /**
   * Navigation target. When set, the chip renders as a real link (anchor) so it
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
   * A trailing chip shown inline with the title. Typically the entity the call
   * acted on — the call's result.
   */
  reference?: ToolCallReference;
}

// The leading status glyph and the indent of every row beneath the title are
// pinned to this width so detail (input chips, notifications, children) aligns
// under the headline rather than under the glyph.
const GLYPH_SLOT_WIDTH = '16px';

function ChipContent({label, value}: {value: string; label?: string}) {
  return label ? (
    <Text size="sm">
      {`${label}: `}
      <Text size="sm" bold>
        {value}
      </Text>
    </Text>
  ) : (
    <Text size="sm" bold>
      {value}
    </Text>
  );
}

function ReferenceChip({reference}: {reference: ToolCallReference}) {
  const {label, value, icon, onClick, to} = reference;
  // No explicit size: `Button`/`LinkButton` already scale their `icon` via
  // `IconDefaultsProvider`, and a hardcoded size here would fight that when the
  // chip's button size ever changes.
  const chipIcon = icon ?? <IconSpan />;
  const content = <ChipContent label={label} value={value} />;

  // A navigation target renders as a real anchor so middle/cmd-click and keyboard access work; an
  // `onClick`-only chip stays a button; a chip with neither is a non-interactive display chip.
  if (to) {
    return (
      <LinkButton size="xs" icon={chipIcon} to={to} onClick={onClick}>
        {content}
      </LinkButton>
    );
  }

  return (
    <Button size="xs" icon={chipIcon} onClick={onClick} disabled={!onClick}>
      {content}
    </Button>
  );
}

/**
 * The hoisted failure marker. A failed call keeps its leading glyph but also
 * surfaces this danger chip in the trailing result slot, where a successful call
 * would show its `reference` — so the outcome is legible on the right rather than
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
        {input}
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
        {output}
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
 * (`ToolCallIndicator`) leads the title; an optional `reference` chip and, on
 * failure, a `failureLabel` chip (the HTTP status) trail it. `input`, `output`,
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
  const hasTrailing = Boolean(reference) || isFailure;
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
          <Text size="sm" variant="secondary" monospace>
            {title}
          </Text>
          {hasTrailing ? (
            <Flex align="center" gap="sm" flexShrink={0}>
              {reference ? <ReferenceChip reference={reference} /> : null}
              {isFailure ? <FailureChip label={failureLabel ?? t('Failed')} /> : null}
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
