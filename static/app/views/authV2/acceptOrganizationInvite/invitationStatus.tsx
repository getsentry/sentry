import {Button, LinkButton} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';

import type {InvitationStep} from './getInvitationStep';

interface InvitationStatusProps {
  isAccepting: boolean;
  onAccept: () => void;
  onSwitchAccount: () => void;
  step: Exclude<InvitationStep, 'authentication'>;
  isCheckingInvite?: boolean;
  isSwitchingAccount?: boolean;
}

export function InvitationStatus({
  isAccepting,
  isCheckingInvite = false,
  isSwitchingAccount = false,
  onAccept,
  onSwitchAccount,
  step,
}: InvitationStatusProps) {
  if (step === 'existing-member') {
    return (
      <Stack gap="md" align="start">
        <Text>{t('This account is already a member of the organization.')}</Text>
        <Button
          size="xs"
          busy={isSwitchingAccount}
          disabled={isSwitchingAccount || isCheckingInvite}
          onClick={onSwitchAccount}
        >
          {t('Switch account')}
        </Button>
      </Stack>
    );
  }

  if (step === 'required-2fa') {
    return (
      <Stack gap="lg" align="start">
        <Text>
          {t(
            'This organization requires all members to configure two-factor authentication. Return to this tab after setting up two-factor to accept your invitation.'
          )}
        </Text>
        <LinkButton
          external
          disabled={isCheckingInvite || isSwitchingAccount}
          variant="primary"
          href={`${ConfigStore.get('links').sentryUrl}/settings/account/security/`}
        >
          {t('Configure Two-Factor Auth')}
        </LinkButton>
      </Stack>
    );
  }

  if (step === 'sign-in-sso') {
    return (
      <Text align="center" variant="muted">
        {t('Sign in with the organization’s SSO provider to continue.')}
      </Text>
    );
  }

  if (step === 'authenticate-sso') {
    return (
      <Text align="center" variant="muted">
        {t('Authenticate with the organization’s SSO provider to continue.')}
      </Text>
    );
  }

  return (
    <Button
      variant="primary"
      busy={isAccepting || isSwitchingAccount}
      disabled={isAccepting || isSwitchingAccount || isCheckingInvite}
      onClick={onAccept}
    >
      {t('Accept invitation')}
    </Button>
  );
}
