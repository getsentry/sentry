import type {ButtonProps} from 'sentry/components/button';
import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';

import type {NormalizedInvite} from './types';

interface Props extends Omit<ButtonProps, 'children'> {
  invites: NormalizedInvite[];
  willInvite: boolean;
}

export default function InviteButton({invites, willInvite, ...buttonProps}: Props) {
  const label = buttonLabel(invites, willInvite);

  return <Button {...buttonProps}>{label}</Button>;
}

function buttonLabel(invites: NormalizedInvite[], willInvite: boolean) {
  if (invites.length > 0) {
    const numberInvites = invites.length;

    // Note we use `t()` here because `tn()` expects the same # of string formatters
    const inviteText =
      numberInvites === 1 ? t('Send invite') : t('Send invites (%s)', numberInvites);
    const requestText =
      numberInvites === 1
        ? t('Send invite request')
        : t('Send invite requests (%s)', numberInvites);

    return willInvite ? inviteText : requestText;
  }

  return willInvite ? t('Send invite') : t('Send invite request');
}
