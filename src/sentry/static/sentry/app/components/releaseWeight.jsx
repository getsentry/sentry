import React from 'react';
import TooltipMixin from '../mixins/tooltip';


const ReleaseWeight = React.createClass({
  propTypes: {
    release: React.PropTypes.object.isRequired,
  },

  mixins: [
    TooltipMixin({
      selector: '.tip',
    }),
  ],

  render() {
    let release = this.props.release;
    let width = release.commitCount / release.projectCommitStats.maxCommits * 100;
    let commitCount = Math.round(
      (release.commitCount - release.projectCommitStats.avgCommits) * 100) / 100;
    let fullBar = {
      width: '100%',
      backgroundColor: '#d3d3d3',
      height: '4px',
      borderRadius: '3px',
    };
    let percentageBar = {
      width: width + '%',
      backgroundColor: commitCount > 5 ? '#e5685f' : '#c1bbc7',
      height: '4px',
      margin: '2px 0 6px'
    };
    if (width === 100) {
      percentageBar.borderRadius = '3px';
    } else {
      percentageBar.borderBottomLeftRadius = '3px';
      percentageBar.borderTopLeftRadius = '3px';
    }
    let title;
    if (commitCount === 0) {
      title = 'This release has an average number of commits for this project';
    } else if (commitCount > 0) {
      title = ('This release has ' + commitCount +
               ' more commits than average for this project');
    } else {
      title = ('This release has ' + Math.abs(commitCount) +
               ' fewer commits than average for this project');
    }
    return (
      <div>
        <div className="tip" title={title} style={fullBar}>
          <div style={percentageBar}></div>
        </div>
      </div>
    );
  }
});

export default ReleaseWeight;
