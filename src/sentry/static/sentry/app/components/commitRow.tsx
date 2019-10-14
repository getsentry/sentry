import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Commit} from 'app/types';
import {PanelItem} from 'app/components/panels';
import {t, tct} from 'app/locale';
import Avatar from 'app/components/avatar';
import CommitLink from 'app/components/commitLink';
import TextOverflow from 'app/components/textOverflow';
import TimeSince from 'app/components/timeSince';
import space from 'app/styles/space';

type Props = {
  commit: Commit;
  customAvatar?: React.ReactNode;
};

export default class CommitRow extends React.Component<Props> {
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

  render() {
    const {commit, customAvatar} = this.props;
    const {id, dateCreated, message, author, repository} = commit;

    return (
      <PanelItem key={id} align="center">
        {customAvatar ? (
          customAvatar
        ) : (
          <AvatarWrapper>
            <Avatar size={36} user={author} />
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
  align-self: flex-start;
  margin-right: ${space(2)};
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

const Meta = styled('p')`
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
  color: ${p => p.theme.gray3};
`;
