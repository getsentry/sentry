import React from 'react';
import ApiMixin from '../mixins/apiMixin';
import {t} from '../locale';
import LoadingIndicator from './loadingIndicator';
import LoadingError from './loadingError';
import TimeSince from './timeSince';

const RecentReleaseDeploys = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string,
    version: React.PropTypes.object
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      deploys: [],
      loading: true
    };
  },

  componentWillMount() {
    this.fetchData();
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
      return <LoadingIndicator />;
    }
    if (this.state.error) {
      return <LoadingError />;
    }
    let {deploys} = this.state;
    let recentDeploysByEnviroment = deploys.reduce(function(dbe, deploy) {
      let {dateFinished, environment} = deploy;
      if (!dbe.hasOwnProperty(environment)) {
        dbe[environment] = dateFinished;
      }

      return dbe;
    }, {});
    let mostRecentDeploySlice = Object.keys(recentDeploysByEnviroment);
    if (Object.keys(recentDeploysByEnviroment).length > 3) {
      mostRecentDeploySlice = Object.keys(recentDeploysByEnviroment).slice(0, 3);
    }
    return (
      <div>
        {deploys &&
          mostRecentDeploySlice.map((env, idx) => {
            let dateFinished = recentDeploysByEnviroment[env];
            return (
              <div className="deploy">
                <div key={idx} className="deploy-meta">
                  <strong>
                    {t('Deployed to ')}{env + ' '}
                  </strong>
                  {dateFinished &&
                    <p className="m-b-0 text-light">
                      <span className="icon icon-clock" />
                      {' '}
                      <TimeSince date={dateFinished} />
                    </p>}
                </div>
              </div>
            );
          })}
      </div>
    );
  }
});

export default RecentReleaseDeploys;
