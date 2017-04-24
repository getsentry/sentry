import React from 'react';
import ApiMixin from '../mixins/apiMixin';
import TooltipMixin from '../mixins/tooltip';
import LoadingIndicator from './loadingIndicator';
import LoadingError from './loadingError';
import TimeSince from './timeSince';
import {t} from '../locale';

const LatestDeployOrReleaseTime = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string,
    version: React.PropTypes.string,
    releaseDateCreated: React.PropTypes.string
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
    let {deploys} = this.state;
    let earlierDeploysNum = deploys.length - 1;
    return (
      <div>
        {deploys.length > 0 && deploys[0].dateFinished
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
                  {deploys[0].environment + ' '}
                </span>
                {' '}
                <span className="icon icon-clock" />
                {' '}
                <TimeSince date={deploys[0].dateFinished} />
                {earlierDeploysNum > 0 &&
                  <span className="tip" title={earlierDeploysNum + t(' earlier deploys')}>
                    <span className="badge">{earlierDeploysNum}</span>
                  </span>}
              </p>
            </div>
          : <p className="m-b-0 text-light">
              <span className="icon icon-clock" />
              {' '}
              <TimeSince date={this.props.releaseDateCreated} />
            </p>}
      </div>
    );
  }
});

export default LatestDeployOrReleaseTime;
