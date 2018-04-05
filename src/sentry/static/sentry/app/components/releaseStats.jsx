import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Avatar from './avatar';
import Tooltip from '../components/tooltip';
import {t} from '../locale';

const ReleaseStats = createReactClass({
  displayName: 'ReleaseStats',

  propTypes: {
    release: PropTypes.object,
  },

  render() {
    let release = this.props.release;
    let commitCount = release.commitCount || 0;
    let authorCount = (release.authors && release.authors.length) || 0;
    if (commitCount === 0) {
      return null;
    }

    let releaseSummary =
      commitCount +
      t(commitCount !== 1 ? ' commits ' : ' commit ') +
      t('by ') +
      authorCount +
      t(authorCount !== 1 ? ' authors' : ' author');

    return (
      <div className="release-stats">
        <h6>{releaseSummary}</h6>
        <div className="avatar-grid">
          {release.authors.map((author, i) => {
            return (
              <Tooltip key={i} title={`${author.name} ${author.email}`}>
                <span className="avatar-grid-item">
                  <Avatar user={author} />
                </span>
              </Tooltip>
            );
          })}
        </div>
      </div>
    );
  },
});

export default ReleaseStats;
