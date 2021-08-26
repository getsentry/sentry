import * as React from 'react';
import styled from '@emotion/styled';

import {openInviteMembersModal} from 'app/actionCreators/modal';
import UserAvatar from 'app/components/avatar/userAvatar';
import CommitLink from 'app/components/commitLink';
import Hovercard from 'app/components/hovercard';
import Link from 'app/components/links/link';
import {PanelItem} from 'app/components/panels';
import TextOverflow from 'app/components/textOverflow';
import TimeSince from 'app/components/timeSince';
import {IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Commit, User} from 'app/types';

type Props = {
  commit: Commit;
  customAvatar?: React.ReactNode;
};

class CommitRow extends React.Component<Props> {
  renderMessage(message: Commit['message']): string {
    if (!message) {
      return t('No message provided');
    }

    const firstLine = message.split(/\n/)[0];

    return firstLine;
  }

  renderHovercardBody(author: User) {
    return (
      <EmailWarning>
        {tct(
          'The email [actorEmail] is not a member of your organization. [inviteUser:Invite] them or link additional emails in [accountSettings:account settings].',
          {
            actorEmail: <strong>{author.email}</strong>,
            accountSettings: <StyledLink to="/settings/account/emails/" />,
            inviteUser: (
              <StyledLink
                to=""
                onClick={() =>
                  openInviteMembersModal({
                    initialData: [
                      {
                        emails: new Set([author.email]),
                      },
                    ],
                    source: 'suspect_commit',
                  })
                }
              />
            ),
          }
        )}
      </EmailWarning>
    );
  }

  render() {
    const {commit, customAvatar, ...props} = this.props;
    const {id, dateCreated, message, author, repository} = commit;
    const nonMemberEmail = author && author.id === undefined;

    return (
      <PanelItem key={id} {...props}>
        {customAvatar ? (
          customAvatar
        ) : nonMemberEmail ? (
          <AvatarWrapper>
            <Hovercard body={this.renderHovercardBody(author!)}>
              <UserAvatar size={36} user={author} />
              <EmailWarningIcon>
                <IconWarning size="xs" />
              </EmailWarningIcon>
            </Hovercard>
          </AvatarWrapper>
        ) : (
          <AvatarWrapper>
            <UserAvatar size={36} user={author} />
          </AvatarWrapper>
        )}

        <CommitMessage>
          <Message>{this.renderMessage(message)}</Message>
          <Meta>
            {tct('[author] committed [timeago]', {
              author: <strong>{(author && author.name) || t('Unknown author')}</strong>,
              timeago: <TimeSince date={dateCreated} />,
            })}
          </Meta>
        </CommitMessage>

        <div>
          <CommitLink commitId={id} repository={repository} />
        </div>
      </PanelItem>
    );
  }
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
  border: 1px solid ${p => p.theme.white};
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

export default styled(CommitRow)`
  align-items: center;
`;
