import React from 'react';

import Avatar from './avatar';
import TimeSince from './timeSince';

import {t} from '../locale';

const LastCommit = React.createClass({
  propTypes: {
    lastCommit: React.PropTypes.object.isRequired,
    headerClass: React.PropTypes.string
  },

  renderMessage(message) {
    if (!message) {
      return t('No message provided');
    }

    if (message.length > 100) {
      let truncated = message.substr(0, 90);
      let words = truncated.split(' ');
      // try to not have elipsis mid-word
      if (words.length > 1) {
        words.pop();
        truncated = words.join(' ');
      }
      return truncated + '...';
    }
    return message;
  },

  render() {
    let {lastCommit, headerClass} = this.props;
    let commitAuthor = lastCommit && lastCommit.author;
    return (
      <div>
        <h6 className={headerClass}>Last commit</h6>
        <div className="commit">
          <div className="commit-avatar">
            <Avatar user={commitAuthor || {username: '?'}} />
          </div>
          <div className="commit-message truncate">
            {this.renderMessage(lastCommit.message)}
          </div>
          <div className="commit-meta">
            <strong>
              {(commitAuthor && commitAuthor.name) || t('Unknown Author')}
            </strong>&nbsp;
            <TimeSince date={lastCommit.dateCreated} />
          </div>
        </div>
      </div>
    );
  }
});

export default LastCommit;
