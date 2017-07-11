import React from 'react';
import classNames from 'classnames';
import {onboardingSteps, stepDescriptions} from './utils';

const ProgressNodes = React.createClass({
  propTypes: {
    step: React.PropTypes.number.isRequired
  },

  steps: Object.keys(onboardingSteps),

  node(step, i) {
    let nodeClass = classNames('node', {
      done: i < this.props.step,
      active: i === this.props.step
    });
    return (
      <div className={nodeClass} key={i}>
        <span className={nodeClass} />
        {stepDescriptions[step]}
      </div>
    );
  },
  render() {
    return (
      <div className="onboarding-sidebar">
        <div className="sentry-flag">
          <span href="/" className="icon-sentry-logo" />
          <h4>Sentry</h4>
        </div>
        <div className="progress-nodes">
          {this.steps.map(this.node)}
        </div>
        <div className="stuck">
          {/*
          <p> Stuck?</p>
          <p> Chat with a real person</p>
        */}
        </div>
      </div>
    );
  }
});

export default ProgressNodes;
