import React from 'react';
import DocumentTitle from 'react-document-title';
import {browserHistory} from 'react-router';

import ApiMixin from '../../mixins/apiMixin';
import ProgressNodes from './progress';
import ProjectActions from '../../actions/projectActions';

const OnboardingWizard = React.createClass({
  contextTypes: {
    organization: React.PropTypes.object
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      platform: '',
      projectName: ''
    };
  },

  renderStep() {
    const stepProps = {
      next: this.next,
      platform: this.state.platform,
      setPlatform: p => {
        if (!this.state.projectName || this.state.platform === this.state.projectName) {
          this.setState({projectName: p});
        }
        this.setState({platform: p});
      },
      name: this.state.projectName,
      setName: n => this.setState({projectName: n})
    };
    return React.cloneElement(this.props.children, stepProps);
  },

  getProjectUrlProps(project) {
    let org = this.context.organization;
    let path = `/onboarding/${org.slug}/${project.slug}/configure/${this.state.platform}`;
    return path;
  },

  createProject() {
    let {orgId} = this.props.params;
    let {name} = this.context.organization;

    // NOTE: in onboarding, team name matches org name so can
    // make this assumption (But not the org slug, which may have an extra id attached!)
    // orgs with multiple projects may not be able to make this assumption

    this.api.request(`/teams/${orgId}/${name}/projects/`, {
      method: 'POST',
      data: {
        name: this.state.projectName,
        platform: this.state.platform
      },
      success: data => {
        data = {
          ...data,
          orgId: orgId,
          teamId: orgId
        };

        ProjectActions.createSuccess(data);

        // navigate to new url _now_
        const url = this.getProjectUrlProps(data);
        browserHistory.push(url);
      },
      error: err => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  next() {
    if (this.context.organization) {
      this.createProject();
    } else {
      browserHistory.push('another route');
    }
  },

  render() {
    return (
      <div className="onboarding-container">
        <DocumentTitle title={'Sentry'} />
        <div className="step-container">
          <ProgressNodes params={this.props.params} />
          <div>
            <this.renderStep />
          </div>
        </div>
      </div>
    );
  }
});

export default OnboardingWizard;
