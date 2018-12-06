import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import classNames from 'classnames';

import {analytics} from 'app/utils/analytics';
import ConfigStore from 'app/stores/configStore';
import HookStore from 'app/stores/hookStore';
import {onboardingSteps, stepDescriptions} from 'app/views/onboarding/utils';

const ProgressNodes = createReactClass({
  displayName: 'ProgressNodes',

  propTypes: {
    params: PropTypes.object,
  },

  contextTypes: {
    organization: PropTypes.object,
    location: PropTypes.object,
  },

  componentDidMount() {
    let {params} = this.props;
    let step = this.inferStep();
    let eventName =
      step === 1 ? 'onboarding.create_project_viewed' : 'onboarding.configure_viewed';

    let data = {org_id: parseInt(this.context.organization.id, 10)};

    if (step === 2) {
      data.project = params.projectId;
      data.platform = params.platform;
    }

    analytics(eventName, data);
  },

  steps: Object.keys(onboardingSteps),

  getSteps() {
    let organization = this.context.organization;
    let user = ConfigStore.get('user');

    return (
      HookStore.get('component:onboarding-sidebar').length &&
      HookStore.get('component:onboarding-sidebar')[0]('steps', {
        onboardingSteps,
        organization,
        user,
      })
    );
  },

  getStepDescriptions() {
    let organization = this.context.organization;
    let user = ConfigStore.get('user');

    return (
      HookStore.get('component:onboarding-sidebar').length &&
      HookStore.get('component:onboarding-sidebar')[0]('stepDescriptions', {
        stepDescriptions,
        organization,
        user,
      })
    );
  },

  inferStep() {
    let {pathname} = this.context.location;
    let {params} = this.props;
    let steps = this.getSteps();

    if (!params.projectId) return steps.project;
    if (pathname.indexOf('/survey/') !== -1) return steps.survey;

    return steps.configure;
  },

  node(stepKey, stepIndex) {
    let nodeClass = classNames('node', {
      done: stepIndex < this.inferStep(),
      active: stepIndex === this.inferStep(),
    });

    let descriptions = this.getStepDescriptions();
    return (
      <div className={nodeClass} key={stepIndex}>
        <span className={nodeClass} />
        {descriptions[stepKey]}
      </div>
    );
  },

  render() {
    let config = ConfigStore.getConfig();
    let {slug} = this.context.organization;
    let steps = Object.keys(this.getSteps());

    return (
      <div className="onboarding-sidebar">
        <div className="sentry-flag">
          <span href="/" className="icon-sentry-logo-full" />
        </div>
        <div className="progress-nodes">{steps.map(this.node)}</div>
        <div className="stuck">
          <a
            href={
              !config.isOnPremise
                ? `/organizations/${slug}/support/`
                : 'https://forum.sentry.io/'
            }
          >
            <p> Stuck?</p>
            <p> Ask for help</p>
          </a>
        </div>
      </div>
    );
  },
});

export default ProgressNodes;
