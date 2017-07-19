import React from 'react';
import ApiMixin from '../mixins/apiMixin';
import TooltipMixin from '../mixins/tooltip';
import TimeSince from './timeSince';
import {t} from '../locale';

const LatestDeployOrReleaseTime = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    release: React.PropTypes.object.isRequired
  },

  mixins: [
    ApiMixin,
    TooltipMixin({
      selector: '.tip'
    })
  ],

  componentDidUpdate(prevProps, prevState) {
    this.removeTooltips();
    this.attachTooltips();
  },

  render() {
    let {release} = this.props;
    let earlierDeploysNum = release.totalDeploys - 1;
    let latestDeploy = release.lastDeploy;
    // if there are deploys associated with the release
    // render the most recent deploy (API will return data ordered by dateFinished)
    // otherwise, render the dateCreated associated with release
    return (
      <div>
        {latestDeploy && latestDeploy.dateFinished
          ? <div className="deploy">
              <p className="m-b-0 text-light">
                <span
                  className="repo-label"
                  style={{
                    padding: 3,
                    display: 'inline-block',
                    width: 70,
                    maxWidth: 86,
                    textAlign: 'center',
                    fontSize: 12
                  }}>
                  {latestDeploy.environment + ' '}
                </span>
                {' '}
                <span className="icon icon-clock" />
                {' '}
                <TimeSince date={latestDeploy.dateFinished} />
                {earlierDeploysNum > 0 &&
                  <span className="tip" title={earlierDeploysNum + t(' earlier deploys')}>
                    <span className="badge">{earlierDeploysNum}</span>
                  </span>}
              </p>
            </div>
          : <p className="m-b-0 text-light">
              <span className="icon icon-clock" />
              {' '}
              <TimeSince date={release.dateCreated} />
            </p>}
      </div>
    );
  }
});

export default LatestDeployOrReleaseTime;
