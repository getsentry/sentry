import {useId} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
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
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  message: string | null;
  onApply: () => void;
  onRecheck: () => void;
  rechecking: boolean;
};

export function ApplyButton({
  applying,
  busyLabel,
  canApply,
  check,
  disabled,
  icon,
  label,
  message,
  onApply,
  onRecheck,
  rechecking,
}: ApplyButtonProps) {
  const messageId = useId();
  const checking = canApply && check.status === 'pending';
  const recheck = check.status === 'blocked' && check.error.code === 'stale';
  function getLabel() {
    if (rechecking) {
      return t('Rechecking suggestion…');
    }
    if (recheck) {
      return t('Recheck suggestion');
    }
    return applying ? busyLabel : label;
  }

  return (
    <Flex align="center" gap="md" wrap="wrap">
      <Button
        variant="primary"
        icon={icon}
        busy={applying || rechecking || checking}
        disabled={
          applying ||
          rechecking ||
          checking ||
          disabled ||
          !canApply ||
          (check.status === 'blocked' && !recheck)
        }
        aria-describedby={message ? messageId : undefined}
        onClick={recheck ? onRecheck : onApply}
      >
        {getLabel()}
      </Button>
      <Text id={messageId} role="status" size="sm" variant="muted">
        {message}
      </Text>
    </Flex>
  );
}
