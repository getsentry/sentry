import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {Commit} from 'app/types';
import {openInviteMembersModal} from 'app/actionCreators/modal';
import {PanelItem} from 'app/components/panels';
import {t, tct} from 'app/locale';
import UserAvatar from 'app/components/avatar/userAvatar';
import CommitLink from 'app/components/commitLink';
import Hovercard from 'app/components/hovercard';
import {IconFlag} from 'app/icons';
import Link from 'app/components/links/link';
import TextOverflow from 'app/components/textOverflow';
import TimeSince from 'app/components/timeSince';
import space from 'app/styles/space';
import ScoreBar from 'app/components/scoreBar';
import theme from 'app/utils/theme';

type Props = {
  commit: Commit;
  customAvatar?: React.ReactNode;
};

const ScoreConfidenceToScore = {
  Low: 1,
  Medium: 2,
  High: 3,
};

class CommitRow extends React.Component<Props> {
  static propTypes = {
    commit: PropTypes.object,
    customAvatar: PropTypes.node,
  };

  renderMessage(message: string): string {
    if (!message) {
      return t('No message provided');
    }

    const firstLine = message.split(/\n/)[0];

    return firstLine;
  }

  renderEmailWarningHovercardBody(author) {
    return (
      <CommitHoverCardBody>
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
      </CommitHoverCardBody>
    );
  }
  renderCommitScoreHovercardBody(scoreConfidence, scoreReason) {
    return (
      <CommitHoverCardBody>
        <div>
          <strong>Confidence: </strong> {scoreConfidence}
        </div>
        <div>{scoreReason}</div>
      </CommitHoverCardBody>
    );
  }
  render() {
    const {commit, customAvatar, ...props} = this.props;
    const {
      id,
      dateCreated,
      message,
      author,
      repository,
      scoreConfidence,
      scoreReason,
    } = commit;
    const nonMemberEmail = author && author.id === undefined;

    return (
      <PanelItem key={id} {...props}>
        {customAvatar ? (
          customAvatar
        ) : nonMemberEmail ? (
          <AvatarWrapper>
            <Hovercard body={this.renderEmailWarningHovercardBody(author)}>
              <UserAvatar size={36} user={author} />
              <EmailWarningIcon />
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

        <CommitScoreWrapper>
          <Hovercard
            body={this.renderCommitScoreHovercardBody(scoreConfidence, scoreReason)}
          >
            <div style={{width: 40}}>
              <ScoreBar
                size={20}
                thickness={10}
                score={ScoreConfidenceToScore[scoreConfidence]}
                palette={[
                  theme.similarity.colors[0],
                  theme.similarity.colors[2],
                  theme.similarity.colors[4],
                ]}
              />
            </div>
          </Hovercard>
        </CommitScoreWrapper>
      </PanelItem>
    );
  }
}

const CommitScoreWrapper = styled('div')`
  margin-left: ${space(1.5)};
  width: 40px;
  display: flex;
`;

const AvatarWrapper = styled('div')`
  align-self: flex-start;
  margin-right: ${space(2)};
`;

const CommitHoverCardBody = styled('div')`
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

const EmailWarningIcon = styled(IconFlag)`
  position: relative;
  margin-left: -11px;
  border-radius: 11px;
  margin-bottom: -25px;
  border: 1px solid ${p => p.theme.white};
  background: ${p => p.theme.yellow300};
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
  color: ${p => p.theme.gray600};
`;

export default styled(CommitRow)`
  align-items: center;
`;
