import React from 'react';
import DocumentTitle from 'react-document-title';

import ApiMixin from '../../mixins/apiMixin';

import Info from './info';
import Project from './project';
import Setup from './setup';

import ProgressNodes from './progress';
import {onboardingSteps} from './utils';

const OnboardingWizard = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      options: {},
      step: onboardingSteps.ready
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  renderStep() {
    //eslint-disable-next-line react/jsx-key
    const component = [<Info />, <Project />, <Setup />][this.state.step];
    return (
      <div>
        {component}
      </div>
    );
  },

  fetchData(callback) {
    this.api.request('/internal/options/?query=is:required', {
      method: 'GET',
      success: data => {
        this.setState({
          options: data,
          loading: false,
          error: false
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  next() {
    this.setState({step: this.state.step + 1});
  },

  render() {
    return (
      <div>
        <DocumentTitle title={'Sentry'} />
        <h1>ONBOARDING</h1>
        <div className="onboarding-container">

          <ProgressNodes step={this.state.step} />
          <div
            className="btn"
            onClick={() => {
              this.setState({step: this.state.step + 1});
            }}
          />
          <div>
            <this.renderStep />
            <div className="btn btn-primary" onClick={this.next}>
              next step
            </div>
          </div>
        </div>
      </div>
    );
  }
});

export default OnboardingWizard;
