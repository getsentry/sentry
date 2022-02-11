import * as React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import UserAvatar from 'sentry/components/avatar/userAvatar';
import CommitLink from 'sentry/components/commitLink';
import {Hovercard} from 'sentry/components/hovercard';
import Link from 'sentry/components/links/link';
import {PanelItem} from 'sentry/components/panels';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Commit} from 'sentry/types';

function formatCommitMessage(message: string | null) {
  if (!message) {
    return t('No message provided');
  }

  return message.split(/\n/)[0];
}

interface CommitRowProps {
  commit: Commit;
  className?: string;
  customAvatar?: React.ReactNode;
}

function CommitRow({commit, customAvatar, className}: CommitRowProps) {
  const handleInviteClick = React.useCallback(() => {
    if (!commit.author?.email) {
      Sentry.captureException(
        new Error(`Commit author has no email or id, invite flow is broken.`)
      );
      return;
    }

    openInviteMembersModal({
      initialData: [
        {
          emails: new Set([commit.author.email]),
        },
      ],
      source: 'suspect_commit',
    });
  }, [commit.author]);

  return (
    <PanelItem key={commit.id} className={className}>
      {customAvatar ? (
        customAvatar
      ) : commit.author && commit.author.id === undefined ? (
        <AvatarWrapper>
          <Hovercard
            body={
              <EmailWarning>
                {tct(
                  'The email [actorEmail] is not a member of your organization. [inviteUser:Invite] them or link additional emails in [accountSettings:account settings].',
                  {
                    actorEmail: <strong>{commit.author.email}</strong>,
                    accountSettings: <StyledLink to="/settings/account/emails/" />,
                    inviteUser: <StyledLink to="" onClick={handleInviteClick} />,
                  }
                )}
              </EmailWarning>
            }
          >
            <UserAvatar size={36} user={commit.author} />
            <EmailWarningIcon>
              <IconWarning size="xs" />
            </EmailWarningIcon>
          </Hovercard>
        </AvatarWrapper>
      ) : (
        <AvatarWrapper>
          <UserAvatar size={36} user={commit.author} />
        </AvatarWrapper>
      )}

      <CommitMessage>
        <Message>{formatCommitMessage(commit.message)}</Message>
        <Meta>
          {tct('[author] committed [timeago]', {
            author: <strong>{commit.author?.name ?? t('Unknown author')}</strong>,
            timeago: <TimeSince date={commit.dateCreated} />,
          })}
        </Meta>
      </CommitMessage>

      <div>
        <CommitLink commitId={commit.id} repository={commit.repository} />
      </div>
    </PanelItem>
  );
}

const AvatarWrapper = styled('div')`
  position: relative;
  align-self: flex-start;
  margin-right: ${space(2)};
`;

const EmailWarning = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1.4;
  margin: -4px;
`;

const StyledLink = styled(Link)`
  color: ${p => p.theme.textColor};
  border-bottom: 1px dotted ${p => p.theme.textColor};

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

const EmailWarningIcon = styled('span')`
  position: absolute;
  bottom: -6px;
  right: -7px;
  line-height: 12px;
  border-radius: 50%;
  border: 1px solid ${p => p.theme.background};
  background: ${p => p.theme.yellow200};
  padding: 1px 2px 3px 2px;
`;

const CommitMessage = styled('div')`
  flex: 1;
  flex-direction: column;
  min-width: 0;
  margin-right: ${space(2)};
`;

const Message = styled(TextOverflow)`
  font-size: 15px;
  line-height: 1.1;
  font-weight: bold;
`;

const Meta = styled(TextOverflow)`
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
  color: ${p => p.theme.subText};
`;

const StyledCommitRow = styled(CommitRow)`
  align-items: center;
`;

export {StyledCommitRow as CommitRow};
