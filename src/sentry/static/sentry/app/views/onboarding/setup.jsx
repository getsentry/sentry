import React from 'react';
import {onboardingSteps} from './utils';

const Setup = React.createClass({
  getInitialState() {
    return {
      email: ''
    };
  },

  steps: Object.keys(onboardingSteps),
  render() {
    return (
      <div className="onboarding-setup">
        <h3>Here's docs on setting up your thing:</h3>
        <p>it's specific to your language and platform</p>
        <pre>
          {"<script src='https://cdn.ravenjs.com/3.15.0/raven.min.js'></script>"}
        </pre>
        <pre>
          {
            "Raven.config('https://f724a8a027db45f5b21507e7142ff78e@sentry.io/54785').install()"
          }
        </pre>
      </div>
    );
  }
});

export default Setup;
