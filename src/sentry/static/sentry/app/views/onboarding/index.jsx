import React from 'react';
import DocumentTitle from 'react-document-title';

import ApiMixin from '../../mixins/apiMixin';

import Project from './project/';
import Configure from './configure/';
import Next from './next/';

import ProgressNodes from './progress';
import {onboardingSteps} from './utils';

const OnboardingWizard = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      step: onboardingSteps.project,
      platform: '',
      projectName: '',
      project: null
    };
  },

  renderStep() {
    const stepProps = {
      next: this.next,
      platform: this.state.platform,
      setPlatform: p => this.setState({platform: p}),
      name: this.state.projectName,
      setName: n => this.setState({projectName: n}),
      project: this.state.project,
      params: this.props.params
    };
    return (
      <div>
        {
          [
            //eslint-disable-next-line react/jsx-key
            <Project {...stepProps} />,
            //eslint-disable-next-line react/jsx-key
            <Configure {...stepProps} />,
            //eslint-disable-next-line react/jsx-key
            <Next {...stepProps} />
          ][this.state.step]
        }
      </div>
    );
  },

  createProject(callback) {
    let org = this.props.params.orgId;
    this.api.request(`/teams/${org}/${org}/projects/`, {
      method: 'POST',
      data: {
        name: this.state.projectName,
        platform: this.state.platform
      },
      success: data => {
        console.log(data);
        this.setState({
          project: data,
          loading: false,
          error: false
        });
        callback();
      },
      error: err => {
        console.log(err);
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  next() {
    if (this.state.step === onboardingSteps.project) {
      this.createProject(() => {
        this.setState({step: this.state.step + 1}); //TODO(maxbittker) clean this up
      });
    } else this.setState({step: this.state.step + 1});
  },

  render() {
    return (
      <div className="onboarding-container">
        <DocumentTitle title={'Sentry'} />
        <h1>ONBOARDING</h1>
        <div className="step-container">
          <ProgressNodes step={this.state.step} />
          <div
            className="btn"
            onClick={() => {
              this.setState({step: this.state.step + 1});
            }}
          />
          <div>
            <this.renderStep />
          </div>
        </div>
      </div>
    );
  }
});

export default OnboardingWizard;
