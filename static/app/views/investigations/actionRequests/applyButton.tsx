import {useId} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {ActionRequestError} from 'sentry/views/investigations/api';

export type ApplyCheck =
  | {status: 'pending'}
  | {status: 'passed'}
  | {error: ActionRequestError; status: 'blocked'}
  | {status: 'unavailable'};

type ApplyButtonProps = {
  applying: boolean;
  busyLabel: string;
  canApply: boolean;
  check: ApplyCheck;
  icon: React.ReactNode;
  label: string;
  message: string | null;
  onApply: () => void;
};

export function ApplyButton({
  applying,
  busyLabel,
  canApply,
  check,
  icon,
  label,
  message,
  onApply,
}: ApplyButtonProps) {
  const messageId = useId();
  const checking = canApply && check.status === 'pending';
  return (
    <Flex align="center" gap="md" wrap="wrap">
      <Button
        variant="primary"
        icon={icon}
        busy={applying || checking}
        disabled={applying || checking || !canApply || check.status === 'blocked'}
        aria-describedby={message ? messageId : undefined}
        onClick={onApply}
      >
        {applying ? busyLabel : label}
      </Button>
      <Text id={messageId} role="status" size="sm" variant="muted">
        {message}
      </Text>
    </Flex>
  );
}
