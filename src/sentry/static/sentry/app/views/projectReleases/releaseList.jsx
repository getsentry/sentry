import React from 'react';
import ReleaseStats from '../../components/releaseStats';
import Count from '../../components/count';
import TimeSince from '../../components/timeSince';
import Version from '../../components/version';
import LatestDeployOrReleaseTime from '../../components/latestDeployOrReleaseTime';

const ReleaseList = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    releaseList: React.PropTypes.array.isRequired
  },

  render() {
    let {orgId, projectId} = this.props;

    return (
      <ul className="list-group list-group-lg">
        {this.props.releaseList.map(release => {
          return (
            <li className="list-group-item" key={release.version}>
              <div className="row row-center-vertically">
                <div className="col-sm-4 col-xs-6">
                  <h2>
                    <Version
                      orgId={orgId}
                      projectId={projectId}
                      version={release.version}
                    />
                  </h2>
                  <LatestDeployOrReleaseTime orgId={orgId} release={release} />
                </div>
                <div className="col-sm-4 hidden-xs">
                  <ReleaseStats release={release} />
                </div>
                <div className="col-sm-2 col-xs-3 text-big text-light">
                  <Count className="release-count" value={release.newGroups} />
                </div>
                <div className="col-sm-2 col-xs-3 text-light">
                  {release.lastEvent
                    ? <TimeSince date={release.lastEvent} />
                    : <span>—</span>}
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
