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

  componentWillMount() {
    const {platform} = this.props.params;
    //TODO(maxbittker) redirect if platform is not known.
    if (!platform || platform === 'other') {
      this.redirectToNeutralDocs();
    }
  },

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

  redirectToNeutralDocs() {
    const {orgId, projectId} = this.props.params;
    const url = `/${orgId}/${projectId}/getting-started`;
    browserHistory.push(url);
  },

  render() {
    const {orgId, projectId} = this.props.params;

    return (
      <div>
        <Waiting />
        <div className="onboarding-Configure">

          <ProjectContext projectId={projectId} orgId={orgId}>
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
          <div className="btn btn-primary" onClick={this.submit}>
            skip configure
          </div>
        </div>
      </div>
    );
  }
});

export default Configure;
