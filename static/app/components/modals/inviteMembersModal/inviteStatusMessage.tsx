import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconCheckmark, IconWarning} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';

import type {InviteStatus} from './types';

interface InviteCountProps {
  count: number;
  label: string;
  isRequest?: boolean;
}

function InviteCount({count, label, isRequest}: InviteCountProps) {
  return (
    <BoldCount data-test-id={label}>
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
  const invites = (
    <InviteCount count={sentCount} label="sent-invites" isRequest={isRequest} />
  );
  const failedInvites = (
    <InviteCount count={errorCount} label="failed-invites" isRequest={isRequest} />
  );
  const tctComponents = {
    invites,
    failed: errorCount,
    failedInvites,
  };
  return (
    <div>
      {sentCount > 0 && (
        <StatusMessage status="success" isNewInviteModal>
          <IconCheckmark size="sm" />
          <span>{tct('[invites] sent.', tctComponents)}</span>
        </StatusMessage>
      )}
      {errorCount > 0 && (
        <StatusMessage status="error" isNewInviteModal>
          <IconWarning size="sm" />
          <span>{tct('[failedInvites] failed to send.', tctComponents)}</span>
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
  hasDuplicateEmails,
  inviteStatus,
  sendingInvites,
  willInvite,
}: InviteStatusMessageProps) {
  const organization = useOrganization();
  const isNewInviteModal = organization.features.includes('invite-members-new-modal');

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

    if (isNewInviteModal) {
      return (
        <CountMessage
          sentCount={sentCount}
          errorCount={errorCount}
          isRequest={!willInvite}
        />
      );
    }

    if (willInvite) {
      const invites = (
        <strong data-test-id="sent-invites">
          {tn('%s invite', '%s invites', sentCount)}
        </strong>
      );
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
      <strong data-test-id="sent-invite-requests">
        {tn('%s invite request', '%s invite requests', sentCount)}
      </strong>
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

  // TODO(mia): remove once old modal is removed
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

  > :first-child {
    ${p =>
      p.status === 'success'
        ? `color: ${p.theme.successText}`
        : p.status === 'error' && p.isNewInviteModal && `color: ${p.theme.errorText}`};
  }
`;

export const BoldCount = styled('div')`
  display: inline;
  font-weight: bold;
`;
