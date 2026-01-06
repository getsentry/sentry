import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {useInviteMembersContext} from 'sentry/components/modals/inviteMembersModal/inviteMembersContext';
import {IconCheckmark, IconWarning} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';

interface InviteCountProps {
  count: number;
  isRequest?: boolean;
}

function InviteCount({count, isRequest}: InviteCountProps) {
  return (
    <Text bold>
      {isRequest
        ? tn('%s invite request', '%s invite requests', count)
        : tn('%s invite', '%s invites', count)}
    </Text>
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
        <Flex gap="md" align="center">
          <IconCheckmark size="sm" variant="success" />
          <span role="alert" aria-label={t('Sent Invites')}>
            {tct('[invites] sent.', tctComponents)}
          </span>
        </Flex>
      )}
      {errorCount > 0 && (
        <Flex gap="md" align="center">
          <IconWarning size="sm" variant="danger" />
          <span role="alert" aria-label={t('Failed Invites')}>
            {tct('[failedInvites] failed to send.', tctComponents)}
          </span>
        </Flex>
      )}
    </div>
  );
}

export default function InviteStatusMessage() {
  const {complete, inviteStatus, sendingInvites, willInvite} = useInviteMembersContext();
  if (sendingInvites) {
    return (
      <Flex gap="md" align="center">
        <LoadingIndicator mini relative size={16} />
        {willInvite
          ? t('Sending organization invitations\u2026')
          : t('Sending invite requests\u2026')}
      </Flex>
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
