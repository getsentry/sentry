import idx from 'idx';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Flex} from './grid';
import Avatar from './avatar';
import TimeSince from './timeSince';
import CommitLink from './commitLink';
import {t, tct} from '../locale';

import {PanelItem} from './panels';
import TextOverflow from './textOverflow';

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
        <Flex mr={2}>
          <Avatar size={36} user={author} />
        </Flex>
        <Flex flex="1" direction="column">
          <TruncatedText>{this.renderMessage(message)}</TruncatedText>
          <div style={{fontSize: 13}}>
            {tct('[author] committed [timeago]', {
              author: <strong>{idx(author, _ => _.name) || t('Unknown author')}</strong>,
              timeago: <TimeSince date={dateCreated} />,
            })}
          </div>
        </Flex>
        <Flex className="hidden-xs">
          <CommitLink commitId={id} repository={repository} />
        </Flex>
      </PanelItem>
    );
  }
}

const TruncatedText = styled(TextOverflow)`
  font-size: 15px;
  font-weight: bold;
`;
