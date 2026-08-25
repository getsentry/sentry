import type {MouseEvent, ReactNode} from 'react';
import type {LocationDescriptor} from 'history';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex} from '@sentry/scraps/layout';
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
   * icon once settled) via `ToolCallIndicator`.
   */
  status: ToolCallStatus;
  /**
   * The tool call's headline (e.g. `Query spans`, `Read trace waterfall`).
   */
  title: string;
  /**
   * Supplementary detail rendered beneath the title and output — e.g. an
   * expandable request/response for the call. Kept in the title's column so it
   * aligns under the headline rather than the status glyph.
   */
  children?: ReactNode;
  /**
   * Short status lines surfaced beneath the call (e.g. "Truncated to 100 rows").
   */
  notifications?: string[];
  /**
   * The primary result of the call, rendered as a chip under an `Output:` label.
   */
  output?: ToolCallReference;
  /**
   * A trailing chip shown inline with the title. Typically the entity the call
   * acted on.
   */
  reference?: ToolCallReference;
}

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
  const chipIcon = icon ?? <IconSpan size="xs" />;
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

function SecondaryBox({children}: {children: ReactNode}) {
  return (
    <Container background="secondary" radius="md" padding="sm" width="100%">
      {children}
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
 * Built on the same outline `Disclosure` as `ThinkingBlock`: the lifecycle glyph
 * (`ToolCallIndicator`) is the leading item, the `title` is the toggle, and an
 * optional `reference` chip trails it. `output` and `notifications` sit under the
 * title and stay visible; pass `children` to tuck supplementary detail (e.g. the
 * request/response) into the collapsible panel.
 */
export function ToolCall({
  title,
  status,
  output,
  reference,
  notifications,
  children,
}: ToolCallProps) {
  const {t} = useTranslation();

  return (
    <Disclosure variant="outline" size="sm" gap="xs" flex={1}>
      <Disclosure.Title
        leadingItems={
          <ToolCallIndicator status={status} aria-label={getStatusLabel(status, t)} />
        }
        trailingItems={reference ? <ReferenceChip reference={reference} /> : undefined}
      >
        <Text size="sm" variant="secondary" monospace>
          {title}
        </Text>
      </Disclosure.Title>

      {output ? (
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

      {children ? <Disclosure.Content>{children}</Disclosure.Content> : null}
    </Disclosure>
  );
}
