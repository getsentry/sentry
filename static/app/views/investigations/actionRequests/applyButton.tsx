import {useId} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {ApplyError} from 'sentry/views/investigations/api';
import type {
  InvestigationActionApplyErrorCode,
  InvestigationActionRequest,
} from 'sentry/views/investigations/types';

export type ApplyCheck =
  | {status: 'pending'}
  | {status: 'passed'}
  | {error: ApplyError; status: 'blocked'}
  | {status: 'unavailable'};

type ApplyButtonProps = {
  actionRequest: InvestigationActionRequest;
  applying: boolean;
  busyLabel: string;
  check: ApplyCheck;
  getCannotApplyMessage: (reason: InvestigationActionApplyErrorCode) => string | null;
  icon: React.ReactNode;
  label: string;
  onApply: () => void;
};

export function ApplyButton({
  actionRequest,
  applying,
  busyLabel,
  check,
  getCannotApplyMessage,
  icon,
  label,
  onApply,
}: ApplyButtonProps) {
  const messageId = useId();
  const {canApply, cannotApplyReason} = actionRequest;
  const checking = canApply && check.status === 'pending';
  const message = canApply
    ? getCheckMessage(check, getCannotApplyMessage)
    : ((cannotApplyReason && getCannotApplyMessage(cannotApplyReason)) ??
      t("This change can't be applied."));
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

function getCheckMessage(
  check: ApplyCheck,
  getCannotApplyMessage: ApplyButtonProps['getCannotApplyMessage']
) {
  switch (check.status) {
    case 'blocked':
      return getCannotApplyMessage(check.error.code) ?? check.error.detail;
    case 'unavailable':
      return t("Couldn't check this change in advance. Applying it checks it again.");
    default:
      return null;
  }
}
