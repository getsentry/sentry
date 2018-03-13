import idx from 'idx';
import PropTypes from 'prop-types';
import React from 'react';

import Avatar from './avatar';
import TimeSince from './timeSince';
import CommitLink from './commitLink';
import {t, tct} from '../locale';

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
      <li className="list-group-item" key={id}>
        <div className="row row-center-vertically">
          <div className="col-xs-10 list-group-avatar">
            <Avatar user={author} />
            <h5 className="truncate">{this.renderMessage(message)}</h5>
            <p>
              {tct('[author] committed [timeago]', {
                author: (
                  <strong>{idx(author, _ => _.name) || t('Unknown author')}</strong>
                ),
                timeago: <TimeSince date={dateCreated} />,
              })}
            </p>
          </div>
          <div className="col-xs-2 hidden-xs align-right">
            <CommitLink commitId={id} repository={repository} />
          </div>
        </div>
      </li>
    );
  }
}
