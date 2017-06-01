import React from 'react';
import classNames from 'classnames';
import {onboardingSteps} from './utils';

const ProgressNodes = React.createClass({
  propTypes: {
    step: React.PropTypes.number.isRequired
  },

  steps: Object.keys(onboardingSteps),

  node(step, i) {
    let nodeClass = classNames('node', {active: i === this.props.step});

    return (
      <div className={nodeClass} key={i}>
        <h5>{step}</h5>
      </div>
    );
  },
  render() {
    return (
      <div className="progress-nodes">
        {this.steps.map(this.node)}
      </div>
    );
  }
});

export default ProgressNodes;
