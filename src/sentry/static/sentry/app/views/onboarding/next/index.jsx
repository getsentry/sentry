import React from 'react';
import {onboardingSteps} from '../utils';
// import EmailField from '../../components/forms/emailField';
// import TextFieldField from '../../components/forms/textField';

const Next = React.createClass({
  getInitialState() {
    return {
      email: ''
    };
  },

  steps: Object.keys(onboardingSteps),
  render() {
    return (
      <div className="onboarding-info">
        <h2>You did it! invite member, learn more, go to your issue stream!</h2>
      </div>
    );
  }
});

export default Next;
