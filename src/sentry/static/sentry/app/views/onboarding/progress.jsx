import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import classNames from 'classnames';

import {analytics} from 'app/utils/analytics';
import ConfigStore from 'app/stores/configStore';
import {onboardingSteps, stepDescriptions} from 'app/views/onboarding/utils';

const ProgressNodes = createReactClass({
  displayName: 'ProgressNodes',

  propTypes: {
    params: PropTypes.object,
  },

  contextTypes: {
    organization: PropTypes.object,
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

  inferStep() {
    let {projectId} = this.props.params;
    if (!projectId) return onboardingSteps.project;
    return onboardingSteps.configure;
  },

  node(stepKey, stepIndex) {
    let nodeClass = classNames('node', {
      done: stepIndex < this.inferStep(),
      active: stepIndex === this.inferStep(),
    });

    return (
      <div className={nodeClass} key={stepIndex}>
        <span className={nodeClass} />
        {stepDescriptions[stepKey]}
      </div>
    );
  },

  render() {
    let config = ConfigStore.getConfig();
    let {slug} = this.context.organization;

    return (
      <div className="onboarding-sidebar">
        <div className="sentry-flag">
          <span href="/" className="icon-sentry-logo-full" />
        </div>
        <div className="progress-nodes">{this.steps.map(this.node)}</div>
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
