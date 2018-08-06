import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import ApiMixin from 'app/mixins/apiMixin';
import Tooltip from 'app/components/tooltip';
import TimeSince from 'app/components/timeSince';
import {t} from 'app/locale';

const LatestDeployOrReleaseTime = createReactClass({
  displayName: 'LatestDeployOrReleaseTime',

  propTypes: {
    release: PropTypes.object.isRequired,
  },

  mixins: [ApiMixin],

  render() {
    let {release} = this.props;
    let earlierDeploysNum = release.totalDeploys - 1;
    let latestDeploy = release.lastDeploy;
    // if there are deploys associated with the release
    // render the most recent deploy (API will return data ordered by dateFinished)
    // otherwise, render the dateCreated associated with release
    return (
      <div>
        {latestDeploy && latestDeploy.dateFinished ? (
          <div className="deploy">
            <p className="m-b-0 text-light">
              <span
                className="repo-label"
                style={{
                  padding: 3,
                  display: 'inline-block',
                  width: 70,
                  maxWidth: 86,
                  textAlign: 'center',
                  fontSize: 12,
                }}
              >
                {latestDeploy.environment + ' '}
              </span>{' '}
              <span className="icon icon-clock" />{' '}
              <TimeSince date={latestDeploy.dateFinished} />
              {earlierDeploysNum > 0 && (
                <Tooltip title={earlierDeploysNum + t(' earlier deploys')}>
                  <span className="badge">{earlierDeploysNum}</span>
                </Tooltip>
              )}
            </p>
          </div>
        ) : (
          <p className="m-b-0 text-light">
            <span className="icon icon-clock" /> <TimeSince date={release.dateCreated} />
          </p>
        )}
      </div>
    );
  },
});

export default LatestDeployOrReleaseTime;
