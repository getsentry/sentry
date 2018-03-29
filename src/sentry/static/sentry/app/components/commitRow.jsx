import idx from 'idx';
import PropTypes from 'prop-types';
import React from 'react';
import {Flex} from 'grid-emotion';

import Avatar from './avatar';
import TimeSince from './timeSince';
import CommitLink from './commitLink';
import {t, tct} from '../locale';

import PanelItem from '../views/settings/components/panelItem';

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
        <Flex style={{flexGrow: 1, fontSize: 15}} direction="column">
          <strong className="truncate">{this.renderMessage(message)}</strong>
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
