import React from 'react';
import Avatar from './avatar';

const ReleaseStats = React.createClass({
  propTypes: {
    release: React.PropTypes.object,
  },

  render() {
    let release = this.props.release;
    return (
      <div className="release-info">
        <div><b>{release.commitCount} commits by {release.authors.length} authors</b></div>
        {release.authors.map(author => {
          return <Avatar user={author}/>;
        })}
      </div>
    );
  }
});

export default ReleaseStats;
