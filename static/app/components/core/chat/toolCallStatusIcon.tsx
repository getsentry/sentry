import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

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

interface ToolCallStatusIconProps {
  status: ToolCallStatus;
  /**
   * Overrides the default tooltip / accessible label for the status.
   */
  label?: string;
}

/**
 * A compact status icon for a group of agent tool calls: a spinner while they
 * run and a semantic icon once they settle.
 *
 * Placement and sizing of the surrounding slot are the caller's responsibility.
 */
export function ToolCallStatusIcon({status, label}: ToolCallStatusIconProps) {
  const defaultLabel = getDefaultLabel(status);

  if (status === 'content') {
    return null;
  }

  const title = label ?? defaultLabel;

  return (
    <Tooltip title={title}>
      <ToolCallStatusGlyph status={status} label={title} />
    </Tooltip>
  );
}

function ToolCallStatusGlyph({status, label}: {label: string; status: ToolCallStatus}) {
  switch (status) {
    case 'loading':
    case 'pending':
      return <Spinner role="status" aria-label={label} />;
    case 'failure':
      return (
        <Text variant="danger">
          <IconClose size="xs" aria-label={label} />
        </Text>
      );
    case 'mixed':
      return (
        <Text variant="warning">
          <IconWarning size="xs" aria-label={label} />
        </Text>
      );
    case 'success':
      return (
        <Text variant="success">
          <IconCheckmark size="xs" aria-label={label} />
        </Text>
      );
    case 'content':
      return null;
    default:
      return unreachable(status);
  }
}

function getDefaultLabel(status: ToolCallStatus): string {
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
