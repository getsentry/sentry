import React from 'react';
import {onboardingSteps} from './utils';
import EmailField from '../../components/forms/emailField';
import TextFieldField from '../../components/forms/textField';

const Info = React.createClass({
  getInitialState() {
    return {
      email: ''
    };
  },

  steps: Object.keys(onboardingSteps),
  render() {
    return (
      <div className="onboarding-info">
        <h2>Email</h2>
        <EmailField name="email" />
        <h2>Organization name</h2>
        <TextFieldField name="email" />
      </div>
    );
  }
});

export default Info;
