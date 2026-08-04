import type {ReactNode} from 'react';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';

import {QueryTokens} from './queryTokens';
import {ToolCallIndicator, type ToolCallStatus} from './toolCallIndicator';

/**
 * A compact chip referencing an entity a tool call produced or acted on (e.g.
 * `Trace: a3805648`). Rendered as a small button so it can optionally link to
 * the referenced resource.
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
   * Fires when the chip is activated. When omitted the chip is still rendered
   * but non-interactive.
   */
  onClick?: () => void;
}

interface ToolCallProps {
  /**
   * Lifecycle status. Drives the leading glyph (spinner while running, semantic
   * icon once settled) via `ToolCallIndicator`.
   */
  status: ToolCallStatus;
  /**
   * The tool call's headline (e.g. `Query spans`, `Read trace waterfall`).
   */
  title: string;
  /**
   * Short status lines surfaced beneath the call (e.g. "Truncated to 100 rows").
   */
  notifications?: string[];
  /**
   * The primary result of the call, rendered as a chip under an `Output:` label.
   * Only shown for `variant="query"`.
   */
  output?: ToolCallReference;
  /**
   * A raw Sentry search query summarizing the call's input, rendered as filter
   * pills under an `Input:` label. Only shown for `variant="query"`.
   */
  query?: string;
  /**
   * A trailing chip shown inline with the title. Typically the entity a `read`
   * acted on.
   */
  reference?: ToolCallReference;
  /**
   * Presentation flavor:
   * - `read` (default): quiet — a single title line with an optional trailing
   *   `reference` chip. Use for low-signal reads.
   * - `query`: loud — reveals the `query` input pills and any `output` chip.
   */
  variant?: 'read' | 'query';
}

function ReferenceChip({reference}: {reference: ToolCallReference}) {
  const {label, value, icon, onClick} = reference;
  return (
    <Button
      size="xs"
      icon={icon ?? <IconSpan size="xs" />}
      onClick={onClick}
      aria-disabled={onClick ? undefined : true}
    >
      {label ? (
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
      )}
    </Button>
  );
}

function SecondaryBox({children}: {children: ReactNode}) {
  return (
    <Container background="secondary" radius="md" padding="sm" width="100%">
      {children}
    </Container>
  );
}

function getStatusLabel(status: ToolCallStatus): string | undefined {
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
    default:
      return undefined;
  }
}

/**
 * A single agent tool call within a `ThinkingBlock`.
 *
 * Two shapes share one component so a stream of calls reads consistently:
 * quiet `read`s collapse to a title (plus an optional trailing reference), while
 * `query`s expand to show the filters they ran with and the result they found.
 * The leading glyph communicates lifecycle status; see `ToolCallIndicator`.
 */
export function ToolCall({
  title,
  status,
  variant = 'read',
  query,
  output,
  reference,
  notifications,
}: ToolCallProps) {
  const isQuery = variant === 'query';

  return (
    <Flex gap="md" align="start" width="100%">
      <Container paddingTop="sm">
        <ToolCallIndicator status={status} aria-label={getStatusLabel(status)} />
      </Container>
      <Stack gap="xs" flex={1} minWidth={0}>
        <Flex align="center" justify="between" gap="md" minHeight="24px">
          <Text size="sm" variant="secondary" monospace>
            {title}
          </Text>
          {reference ? <ReferenceChip reference={reference} /> : null}
        </Flex>

        {isQuery && query ? (
          <SecondaryBox>
            <QueryTokens query={query} label={t('Input:')} />
          </SecondaryBox>
        ) : null}

        {isQuery && output ? (
          <SecondaryBox>
            <Flex align="center" gap="sm" wrap="wrap">
              <Text size="sm" variant="secondary" monospace bold>
                {t('Output:')}
              </Text>
              <ReferenceChip reference={output} />
            </Flex>
          </SecondaryBox>
        ) : null}

        {notifications?.map((note, i) => (
          <Text key={i} size="sm" variant="muted">
            {note}
          </Text>
        ))}
      </Stack>
    </Flex>
  );
}
