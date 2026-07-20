import {IconCheckmark, IconClose, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {unreachable} from 'sentry/utils/unreachable';

import {Spinner} from './spinner';

/**
 * Aggregate status of a message's tool calls.
 *
 * - `loading` / `pending`: work is in progress (spinner)
 * - `success` / `failure` / `mixed`: terminal outcomes (icon)
 * - `content`: the message has no tool calls, only content — renders nothing
 */
export type ToolCallStatus =
  | 'loading'
  | 'pending'
  | 'success'
  | 'failure'
  | 'mixed'
  | 'content';

interface ToolCallIndicatorProps {
  status: ToolCallStatus;
  /**
   * Overrides the default accessible label for the status.
   */
  'aria-label'?: string;
}

/**
 * A compact status indicator for a group of agent tool calls: a spinner while they
 * run and a semantic icon once they settle.
 *
 * The status is exposed to assistive tech via the glyph's `aria-label`. We
 * intentionally avoid a tooltip: an icon-only tooltip isn't keyboard-focusable and
 * gives sighted users no hint that it's hoverable. Surface any hidden detail (e.g.
 * which calls failed) as visible text in the consumer instead.
 *
 * Placement and sizing of the surrounding slot are the caller's responsibility.
 */
export function ToolCallIndicator({
  status,
  'aria-label': ariaLabel,
}: ToolCallIndicatorProps) {
  if (status === 'content') {
    return null;
  }

  return (
    <ToolCallStatusGlyph
      status={status}
      aria-label={ariaLabel ?? getDefaultAriaLabel(status)}
    />
  );
}

function ToolCallStatusGlyph({
  status,
  'aria-label': ariaLabel,
}: {
  'aria-label': string;
  status: ToolCallStatus;
}) {
  switch (status) {
    case 'loading':
    case 'pending':
      return <Spinner role="status" aria-label={ariaLabel} />;
    case 'failure':
      return <IconClose size="xs" variant="danger" aria-label={ariaLabel} />;
    case 'mixed':
      return <IconWarning size="xs" variant="warning" aria-label={ariaLabel} />;
    case 'success':
      return <IconCheckmark size="xs" variant="success" aria-label={ariaLabel} />;
    case 'content':
      return null;
    default:
      return unreachable(status);
  }
}

function getDefaultAriaLabel(status: ToolCallStatus): string {
  switch (status) {
    case 'loading':
      return t('Running...');
    case 'pending':
      return t('Waiting for approval');
    case 'failure':
      return t('All tool calls failed');
    case 'mixed':
      return t('Some tool calls succeeded and some failed');
    case 'success':
      return t('All tool calls succeeded');
    case 'content':
      return '';
    default:
      unreachable(status);
      return '';
  }
}
