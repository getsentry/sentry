import React from 'react';
import Count from '../../components/count';
import TimeSince from '../../components/timeSince';
import Version from '../../components/version';

const ReleaseList = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    releaseList: React.PropTypes.array.isRequired
  },

  render() {
    let {orgId, projectId} = this.props;

    return (
      <ul className="release-list">
          {this.props.releaseList.map((release) => {
            return (
              <li className="release" key={release.version}>
                <div className="row">
                  <div className="col-sm-8 col-xs-6">
                    <h4><Version orgId={orgId} projectId={projectId} version={release.version} /></h4>
                    <div className="release-meta">
                      <span className="icon icon-clock"></span> <TimeSince date={release.dateCreated} />
                    </div>
                  </div>
                  <div className="col-sm-2 col-xs-3 release-stats stream-count">
                    <Count className="release-count" value={release.newGroups} />
                  </div>
                  <div className="col-sm-2 col-xs-3 release-stats">
                    {release.lastEvent ?
                      <TimeSince date={release.lastEvent} />
                    :
                      <span>&mdash;</span>
                    }
                  </div>
                </div>
              </li>
            );
          })}
      </ul>
    );
  }
});

export default ReleaseList;
