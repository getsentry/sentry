import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {Box} from 'grid-emotion';

import Avatar from 'app/components/avatar';
import TimeSince from 'app/components/timeSince';
import CommitLink from 'app/components/commitLink';
import {t, tct} from 'app/locale';

import {PanelItem} from 'app/components/panels';
import TextOverflow from 'app/components/textOverflow';

export default class CommitRow extends React.Component {
  static propTypes = {
    commit: PropTypes.object,
  };

  renderMessage = message => {
    if (!message) {
      return t('No message provided');
    }

    let firstLine = message.split(/\n/)[0];

    return firstLine;
  };

  render() {
    let {id, dateCreated, message, author, repository} = this.props.commit;
    return (
      <PanelItem key={id} align="center">
        <AvatarWrapper mr={2}>
          <Avatar size={36} user={author} />
        </AvatarWrapper>
        <Box flex="1" direction="column" style={{minWidth: 0}} mr={2}>
          <Message>{this.renderMessage(message)}</Message>
          <Meta>
            {tct('[author] committed [timeago]', {
              author: <strong>{author?.name || t('Unknown author')}</strong>,
              timeago: <TimeSince date={dateCreated} />,
            })}
          </Meta>
        </Box>
        <Box className="hidden-xs">
          <CommitLink commitId={id} repository={repository} />
        </Box>
      </PanelItem>
    );
  }
}

const AvatarWrapper = styled(Box)`
  align-self: flex-start;
`;

const Message = styled(TextOverflow)`
  font-size: 15px;
  line-height: 1.1;
  font-weight: bold;
`;

const Meta = styled.p`
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
  color: ${p => p.theme.gray3};
`;
