import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import classNames from 'classnames';

import {analytics, amplitude} from 'app/utils/analytics';
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
    let {organization} = this.context;
    let user = ConfigStore.get('user');
    let step = this.inferStep();

    if (step === 1) {
      analytics('onboarding.create_project_viewed', {
        org_id: parseInt(organization.id, 10),
      });
      amplitude('Viewed Onboarding Create Project', parseInt(organization.id, 10));
    }

    HookStore.get('analytics:onboarding-survey-log').length &&
      HookStore.get('analytics:onboarding-survey-log')[0](organization, user);
  },

  steps: Object.keys(onboardingSteps),

  getAsset(type) {
    let {organization} = this.context;

    let hook =
      HookStore.get('sidebar:onboarding-assets').length &&
      HookStore.get('sidebar:onboarding-assets')[0]({organization});

    let asset, hookAsset;
    if (type === 'steps') {
      asset = onboardingSteps;
      hookAsset = hook[0];
    } else {
      asset = stepDescriptions;
      hookAsset = hook[1];
    }

    return hook ? hookAsset : asset;
  },

  inferStep() {
    let {pathname} = this.context.location;
    let {params} = this.props;
    let steps = this.getAsset('steps');

    if (!params.projectId) return steps.project;
    if (params.projectId && pathname.indexOf('/configure/') === -1) return steps.survey;

    return steps.configure;
  },

  node(stepKey, stepIndex) {
    let nodeClass = classNames('node', {
      done: stepIndex < this.inferStep(),
      active: stepIndex === this.inferStep(),
    });

    let descriptions = this.getAsset('descriptions');
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
    let steps = Object.keys(this.getAsset('steps'));
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
