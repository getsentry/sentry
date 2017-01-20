import React from 'react';
import Avatar from './avatar';
import TooltipMixin from '../mixins/tooltip';

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
    return (
      <div className="release-info">
        <div><b>{release.commitCount} commits by {release.authors.length} authors</b></div>
        {release.authors.map(author => {
          return (
            <span className="assignee-selector tip"
                 title={author.name + ' ' + author.email }>
              <Avatar user={author}/>
            </span>
          );
        })}
      </div>
    );
  }
});

export default ReleaseStats;
