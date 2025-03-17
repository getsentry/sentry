import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconCheckmark, IconWarning} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import type {InviteStatus} from './types';

interface InviteCountProps {
  count: number;
  isRequest?: boolean;
}

function InviteCount({count, isRequest}: InviteCountProps) {
  return (
    <BoldCount>
      {isRequest
        ? tn('%s invite request', '%s invite requests', count)
        : tn('%s invite', '%s invites', count)}
    </BoldCount>
  );
}

interface CountMessageProps {
  errorCount: number;
  sentCount: number;
  isRequest?: boolean;
}

function CountMessage({sentCount, errorCount, isRequest}: CountMessageProps) {
  const invites = <InviteCount count={sentCount} isRequest={isRequest} />;
  const failedInvites = <InviteCount count={errorCount} isRequest={isRequest} />;
  const tctComponents = {
    invites,
    failed: errorCount,
    failedInvites,
  };
  return (
    <div>
      {sentCount > 0 && (
        <StatusMessage status="success" isNewInviteModal>
          <IconCheckmark size="sm" color="successText" />
          <span role="alert" aria-label={t('Sent Invites')}>
            {tct('[invites] sent.', tctComponents)}
          </span>
        </StatusMessage>
      )}
      {errorCount > 0 && (
        <StatusMessage status="error" isNewInviteModal>
          <IconWarning size="sm" color="errorText" />
          <span role="alert" aria-label={t('Failed Invites')}>
            {tct('[failedInvites] failed to send.', tctComponents)}
          </span>
        </StatusMessage>
      )}
    </div>
  );
}

interface InviteStatusMessageProps {
  complete: boolean;
  hasDuplicateEmails: boolean;
  inviteStatus: InviteStatus;
  sendingInvites: boolean;
  willInvite: boolean;
}

export default function InviteStatusMessage({
  complete,
  inviteStatus,
  sendingInvites,
  willInvite,
}: InviteStatusMessageProps) {
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

    return (
      <CountMessage
        sentCount={sentCount}
        errorCount={errorCount}
        isRequest={!willInvite}
      />
    );
  }

  return null;
}

export const StatusMessage = styled('div')<{
  isNewInviteModal?: boolean;
  status?: 'success' | 'error';
}>`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p =>
    p.status === 'error' && !p.isNewInviteModal ? p.theme.errorText : p.theme.textColor};
`;

export const BoldCount = styled('div')`
  display: inline;
  font-weight: bold;
`;
