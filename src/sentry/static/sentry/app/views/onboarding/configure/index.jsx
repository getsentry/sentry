import React from 'react';
import {onboardingSteps} from '../utils';
import Waiting from './waiting';
import {browserHistory} from 'react-router';
import ApiMixin from '../../../mixins/apiMixin';

import ProjectContext from '../../projects/projectContext';
import ProjectDocsContext from '../../projectInstall/docsContext';
import ProjectInstallPlatform from '../../projectInstall/platform';

// import {platforms} from '../../../../../../integration-docs/_platforms.json';

const Configure = React.createClass({
  mixins: [ApiMixin],


  propTypes: {
    next: React.PropTypes.func
  },

  componentDidMount() {
    this.timer = setInterval(() => { this.fetchEventData() }, 5000);
  },

  componentWillUnmount() {
    clearInterval(this.timer);
  },

  redirectUrl() {
    let orgId= this.props.params.orgId;
    let projectId= this.props.params.projectId;
    const url = `/${orgId}/${projectId}/#welcome`;
    browserHistory.push(url);
  },

  fetchEventData() {
    let orgId= this.props.params.orgId;
    let projectId= this.props.params.projectId;
    this.api.request(`/projects/${orgId}/${projectId}/events/`, {
      method: 'GET',
      success: data => {
        this.checkFirstEvent(data);
      },
      error: () => {
        this.setState({hasError: true});
      }
    });
  },

  checkFirstEvent(data) {
    if (data.length>1){
      this.redirectUrl();
    }
  },

  submit() {
    this.redirectUrl();
  },

  steps: Object.keys(onboardingSteps),
  render() {
    return (
      <div className="onboarding-Configure">
        <Waiting/>
        <ProjectContext
          projectId={this.props.params.projectId}
          orgId={this.props.params.orgId}>
          <ProjectDocsContext>
            <ProjectInstallPlatform platformData={{}} params={this.props.params} />
          </ProjectDocsContext>
        </ProjectContext>
        <div className="btn btn-primary" onClick={this.submit}>
          next step
        </div>
      </div>
    );
  }
});

export default Configure;
