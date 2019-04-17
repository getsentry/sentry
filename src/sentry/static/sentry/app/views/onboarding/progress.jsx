import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {analytics, amplitude} from 'app/utils/analytics';
import {onboardingSteps, stepDescriptions} from 'app/views/onboarding/utils';
import ConfigStore from 'app/stores/configStore';
import HookStore from 'app/stores/hookStore';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';

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
    const {organization} = this.context;
    const user = ConfigStore.get('user');
    const step = this.inferStep();

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
    const {organization} = this.context;

    const hook =
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
    const {pathname} = this.context.location;
    const {params} = this.props;
    const steps = this.getAsset('steps');

    if (!params.projectId) {
      return steps.project;
    }
    if (params.projectId && pathname.indexOf('/configure/') === -1) {
      return steps.survey;
    }

    return steps.configure;
  },

  node(stepKey, stepIndex) {
    const done = stepIndex < this.inferStep();
    const active = stepIndex === this.inferStep();
    const descriptions = this.getAsset('descriptions');

    return (
      <Node key={stepIndex} done={done} active={active} data-test-id="node">
        <NodeIcon src={done ? 'icon-circle-check' : 'icon-circle-empty'} />
        <NodeDescription data-test-id="node-description">
          {descriptions[stepKey]}
        </NodeDescription>
      </Node>
    );
  },

  render() {
    const config = ConfigStore.getConfig();
    const {slug} = this.context.organization;
    const steps = Object.keys(this.getAsset('steps'));
    return (
      <div className="onboarding-sidebar">
        <div className="sentry-flag">
          <span href="/" className="icon-sentry-logo-full" />
        </div>
        <React.Fragment>{steps.map(this.node)}</React.Fragment>
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

const Node = styled('div')`
  display: flex;
  align-items: center;
  width: 220px;
  margin: auto;
  margin-bottom: ${space(4)};
  color: ${p => (p.active ? '#fff' : p.theme.gray2)};
  font-weight: ${p => (p.active ? 600 : 400)};
`;

const NodeIcon = styled(InlineSvg)`
  position: relative;
  margin-right: ${space(1.5)};
  width: 22px;
  height: 22px;
`;

const NodeDescription = styled('div')`
  flex: 1;
  line-height: 1.2;
`;

export default ProgressNodes;
