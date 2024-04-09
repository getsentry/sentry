import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconCheckmark, IconWarning} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import type {InviteStatus} from './types';

interface Props {
  complete: boolean;
  hasDuplicateEmails: boolean;
  inviteStatus: InviteStatus;
  sendingInvites: boolean;
  willInvite: boolean;
}

export default function InviteStatusMessage({
  complete,
  hasDuplicateEmails,
  inviteStatus,
  sendingInvites,
  willInvite,
}: Props) {
  if (sendingInvites) {
    return (
      <StatusMessage>
        <LoadingIndicator mini relative hideMessage size={16} />
        {willInvite
          ? t('Sending organization invitations\u2026')
          : t('Sending invite requests\u2026')}
      </StatusMessage>
    );
  }

  if (complete) {
    const statuses = Object.values(inviteStatus);
    const sentCount = statuses.filter(i => i.sent).length;
    const errorCount = statuses.filter(i => i.error).length;

    if (willInvite) {
      const invites = <strong>{tn('%s invite', '%s invites', sentCount)}</strong>;
      const tctComponents = {
        invites,
        failed: errorCount,
      };

      return (
        <StatusMessage status="success">
          <IconCheckmark size="sm" />
          <span>
            {errorCount > 0
              ? tct('Sent [invites], [failed] failed to send.', tctComponents)
              : tct('Sent [invites]', tctComponents)}
          </span>
        </StatusMessage>
      );
    }
    const inviteRequests = (
      <strong>{tn('%s invite request', '%s invite requests', sentCount)}</strong>
    );
    const tctComponents = {
      inviteRequests,
      failed: errorCount,
    };
    return (
      <StatusMessage status="success">
        <IconCheckmark size="sm" />
        {errorCount > 0
          ? tct(
              '[inviteRequests] pending approval, [failed] failed to send.',
              tctComponents
            )
          : tct('[inviteRequests] pending approval', tctComponents)}
      </StatusMessage>
    );
  }

  if (hasDuplicateEmails) {
    return (
      <StatusMessage status="error">
        <IconWarning size="sm" />
        {t('Duplicate emails between invite rows.')}
      </StatusMessage>
    );
  }

  return null;
}

export const StatusMessage = styled('div')<{status?: 'success' | 'error'}>`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => (p.status === 'error' ? p.theme.errorText : p.theme.textColor)};

  > :first-child {
    ${p => p.status === 'success' && `color: ${p.theme.successText}`};
  }
`;
