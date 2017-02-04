import React from 'react';
import Avatar from './avatar';
import TooltipMixin from '../mixins/tooltip';
import {tct} from '../locale';

const ReleaseStats = React.createClass({
  propTypes: {
    release: React.PropTypes.object,
  },

  mixins: [
    TooltipMixin({
      selector: '.tip'
    }),
  ],

  render() {
    let release = this.props.release;
    let commitCount = release.commitCount || 0;
    let authorCount = release.authors && release.authors.length || 0;
    if (commitCount === 0) {
      return null;
    }

    let releaseSummary = tct('[commitCount] commits by [authorCount] authors', {
      commitCount,
      authorCount
    });

    return (
      <div className="release-stats">
        <h6>{releaseSummary}</h6>
        <div className="avatar-grid">
          {release.authors.map(author => {
            return (
              <span className="avatar-grid-item tip"
                   title={author.name + ' ' + author.email}>
                <Avatar user={author}/>
              </span>
            );
          })}
        </div>
      </div>
    );
  }
});

export default ReleaseStats;
