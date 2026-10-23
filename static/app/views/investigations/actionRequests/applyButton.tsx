import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {ApplyError} from 'sentry/views/investigations/api';
import type {
  InvestigationActionCannotApplyReason,
  InvestigationActionRequest,
} from 'sentry/views/investigations/types';

type ApplyButtonProps = {
  actionRequest: InvestigationActionRequest;
  applying: boolean;
  busyLabel: string;
  cannotApplyMessage: string | null;
  check: ApplyError | null;
  icon: React.ReactNode;
  label: string;
  onApply: () => void;
};

export function ApplyButton({
  actionRequest,
  applying,
  busyLabel,
  cannotApplyMessage,
  check,
  icon,
  label,
  onApply,
}: ApplyButtonProps) {
  const {canApply, cannotApplyReason, state} = actionRequest;
  const message =
    !canApply && state === 'suggested'
      ? (cannotApplyMessage ?? getCannotApplyMessage(cannotApplyReason))
      : (check?.detail ?? null);
  return (
    <Flex align="center" gap="md" wrap="wrap">
      <Button
        variant="primary"
        icon={icon}
        busy={applying}
        disabled={applying || !canApply || check !== null}
        onClick={onApply}
      >
        {applying ? busyLabel : label}
      </Button>
      {message ? (
        <Text size="sm" variant="muted">
          {message}
        </Text>
      ) : null}
    </Flex>
  );
}

function getCannotApplyMessage(reason: InvestigationActionCannotApplyReason | null) {
  switch (reason) {
    case 'investigation_archived':
      return t('Archived investigations are read-only.');
    case 'not_suggested':
      return t('This can no longer be applied.');
    case 'unsupported_action':
      return t("Seer can't apply this kind of change yet.");
    case 'no_access':
      return t("You don't have access to apply this.");
    default:
      return t("This change can't be applied.");
  }
}
