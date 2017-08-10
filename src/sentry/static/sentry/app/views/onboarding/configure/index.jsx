import React from 'react';
import Waiting from './waiting';
import {browserHistory} from 'react-router';
import ApiMixin from '../../../mixins/apiMixin';

import ProjectContext from '../../projects/projectContext';
import ProjectDocsContext from '../../projectInstall/docsContext';
import ProjectInstallPlatform from '../../projectInstall/platform';

import Raven from 'raven-js';

const Configure = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return {
      isFirst: true,
      hasSent: false
    };
  },

  componentWillMount() {
    let {platform} = this.props.params;
    //redirect if platform is not known.
    if (!platform || platform === 'other') {
      this.redirectToNeutralDocs();
    }

    this.fetchEventData();
    this.timer = setInterval(() => {
      this.fetchEventData();
    }, 2000);
  },

  componentWillUnmount() {
    clearInterval(this.timer);
  },

  redirectUrl() {
    let {orgId, projectId} = this.props.params;

    let url = `/${orgId}/${projectId}/#welcome`;
    browserHistory.push(url);
  },

  fetchEventData() {
    let {orgId, projectId} = this.props.params;

    this.api.request(`/projects/${orgId}/${projectId}/events/`, {
      method: 'GET',
      success: data => {
        let {isFirst, hasSent} = this.state;

        // this indicates that a real event has been sent to the project
        var sentEvent = function() {
          if (data.length == 1) {
            let firstError = data[0];
            return !firstError.message.includes('This is an example');
          } else {
            return data.length > 1;
          }
        };

        if (isFirst) {
          // record sentEvent value of first poll to avoid redirecting when someone has already sent an event
          this.setState({
            isFirst: false,
            hasSent: sentEvent()
          });
        } else {
          // if sentEvent changes from false to true then redirect
          if (!hasSent && sentEvent()) {
            this.redirectUrl();
          }
        }
      },

      error: err => {
        Raven.captureMessage('Polling for events in onboarding configure failed', {
          extra: err
        });
      }
    });
  },

  submit() {
    this.redirectUrl();
  },

  redirectToNeutralDocs() {
    let {orgId, projectId} = this.props.params;
    let url = `/${orgId}/${projectId}/getting-started`;

    browserHistory.push(url);
  },

  render() {
    let {orgId, projectId} = this.props.params;

    return (
      <div>
        <div className="onboarding-Configure">
          <h2 style={{marginBottom: 30}}>Configure your application</h2>
          <ProjectContext projectId={projectId} orgId={orgId} style={{marginBottom: 30}}>
            <ProjectDocsContext>
              <ProjectInstallPlatform
                platformData={{
                  hack: 'actually set by ProjectDocsContext, this object is here to avoid proptypes warnings'
                }}
                params={this.props.params}
                linkPath={(_orgId, _projectId, _platform) =>
                  `/onboarding/${_orgId}/${_projectId}/configure/${_platform}/`}
              />
            </ProjectDocsContext>
          </ProjectContext>
          <Waiting skip={this.submit} hasEvent={this.state.hasSent} />
        </div>
      </div>
    );
  }
});

export default Configure;
