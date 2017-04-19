import React from 'react';
import ReleaseStats from '../../components/releaseStats';
import Count from '../../components/count';
import TimeSince from '../../components/timeSince';
import Version from '../../components/version';
import RecentReleaseDeploys from '../../components/recentReleaseDeploys';

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
                <div className="col-sm-3 col-xs-5">
                  <h2>
                    <Version
                      orgId={orgId}
                      projectId={projectId}
                      version={release.version}
                    />
                  </h2>
                  <p className="m-b-0 text-light">
                    <span className="icon icon-clock" />
                    {' '}
                    <TimeSince date={release.dateCreated} />
                  </p>
                </div>
                <div className="col-sm-2 hidden-xs">
                  <ReleaseStats release={release} />
                </div>
                <div className="col-sm-2 col-xs-2 text-big text-light">
                  <Count className="release-count" value={release.newGroups} />
                </div>
                <div className="col-sm-2 col-xs-2 text-light">
                  {release.lastEvent
                    ? <TimeSince date={release.lastEvent} />
                    : <span>—</span>}
                </div>
                <div className="col-sm-3 col-xs-3 text-light">
                  <RecentReleaseDeploys
                    version={release.version}
                    orgId={this.props.orgId}
                  />
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
