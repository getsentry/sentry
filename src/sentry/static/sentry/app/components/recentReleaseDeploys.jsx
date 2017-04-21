import React from 'react';
import ApiMixin from '../mixins/apiMixin';
import TooltipMixin from '../mixins/tooltip';
// import {t} from '../locale';
import LoadingIndicator from './loadingIndicator';
import LoadingError from './loadingError';
import TimeSince from './timeSince';

const RecentReleaseDeploys = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string,
    version: React.PropTypes.object
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
              <div className="deploy" key={idx}>
                <span className="repo-label"  style={{padding: 3, display: 'inline-block', width: 86, maxWidth: 86, textAlign: 'center', fontSize: 12}}>{env + ' '}</span>
                {dateFinished &&
                  <p
                    className="text-light"
                    style={{
                      display: 'inline-block',
                      'padding-left': '10px',
                      'vertical-align': 'baseline'
                    }}
                  >
                    <TimeSince date={dateFinished} />
                  </p>}
              </div>
            );
          })}
      </div>
    );
  }
});

export default RecentReleaseDeploys;
