import React from 'react';
import Avatar from './avatar';
import TooltipMixin from '../mixins/tooltip';
import {t} from '../locale';

const ReleaseStats = React.createClass({
  propTypes: {
    release: React.PropTypes.object
  },

  mixins: [
    TooltipMixin({
      selector: '.tip'
    })
  ],

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
              <span
                key={i}
                className="avatar-grid-item tip"
                title={author.name + ' ' + author.email}>
                <Avatar user={author} />
              </span>
            );
          })}
        </div>
      </div>
    );
  }
});

export default ReleaseStats;
