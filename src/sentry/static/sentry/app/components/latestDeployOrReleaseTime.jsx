import React from 'react';
import ApiMixin from '../mixins/apiMixin';
import TooltipMixin from '../mixins/tooltip';
import LoadingIndicator from './loadingIndicator';
import LoadingError from './loadingError';
import TimeSince from './timeSince';
import {t} from '../locale';

const LatestDeployOrReleaseTime = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    version: React.PropTypes.string.isRequired,
    releaseDateCreated: React.PropTypes.string.isRequired
  },

  mixins: [
    ApiMixin,
    TooltipMixin({
      selector: '.tip'
    })
  ],

  getInitialState() {
    return {
      deploys: [],
      loading: true
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentDidUpdate(prevProps, prevState) {
    if (prevState.loading && !this.state.loading) {
      this.removeTooltips();
      this.attachTooltips();
    }
  },

  fetchData() {
    let deployPath = `/organizations/${this.props.orgId}/releases/${encodeURIComponent(this.props.version)}/deploys/`;
    this.api.request(deployPath, {
      method: 'GET',
      success: data => {
        this.setState({
          deploys: data,
          loading: false
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },
  render() {
    if (this.state.loading) {
      return <LoadingIndicator mini={true} />;
    }
    if (this.state.error) {
      return <LoadingError />;
    }
    let {releaseDateCreated} = this.props;
    let {deploys} = this.state;
    let earlierDeploysNum = deploys.length - 1;
    let latestDeploy = deploys[0];
    // if there are deploys associated with the release
    // render the most recent deploy (API will return data ordered by dateFinished)
    // otherwise, render the dateCreated associated with release
    return (
      <div>
        {deploys.length > 0 && latestDeploy.dateFinished
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
              <TimeSince date={releaseDateCreated} />
            </p>}
      </div>
    );
  }
});

export default LatestDeployOrReleaseTime;
