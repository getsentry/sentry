import React from 'react';
import Waiting from './waiting';
import {browserHistory} from 'react-router';
import ApiMixin from '../../../mixins/apiMixin';

import ProjectContext from '../../projects/projectContext';
import ProjectDocsContext from '../../projectInstall/docsContext';
import ProjectInstallPlatform from '../../projectInstall/platform';

// import {platforms} from '../../../../../../integration-docs/_platforms.json';

const Configure = React.createClass({
  propTypes: {
    next: React.PropTypes.func
  },

  mixins: [ApiMixin],

  componentDidMount() {
    this.timer = setInterval(() => {
      this.fetchEventData();
    }, 2000);
  },

  componentWillUnmount() {
    clearInterval(this.timer);
  },

  redirectUrl() {
    let orgId = this.props.params.orgId;
    let projectId = this.props.params.projectId;
    const url = `/${orgId}/${projectId}/#welcome`;
    browserHistory.push(url);
  },

  fetchEventData() {
    let orgId = this.props.params.orgId;
    let projectId = this.props.params.projectId;
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
    if (data.length > 1) {
      this.redirectUrl();
    }
  },

  submit() {
    this.redirectUrl();
  },

  render() {
    return (
      <div className="onboarding-Configure">
        <Waiting />
        <ProjectContext
          projectId={this.props.params.projectId}
          orgId={this.props.params.orgId}>
          <ProjectDocsContext>
            <ProjectInstallPlatform
              platformData={{
                hack: 'actually set by ProjectDocsContext, this object is here to avoid proptypes warnings'
              }}
              params={this.props.params}
              linkPath={(orgId, projectId, platform) =>
                `/onboarding/${orgId}/${projectId}/configure/${platform}/`}
            />
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
