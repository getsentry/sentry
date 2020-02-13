import PropTypes from 'prop-types';
import React from 'react';

import {ApiForm, RadioBooleanField} from 'app/components/forms';
import {callIfFunction} from 'app/utils/callIfFunction';
import NarrowLayout from 'app/components/narrowLayout';

export default class NewsletterConsent extends React.Component {
  static propTypes = {
    onSubmitSuccess: PropTypes.func,
  };

  componentDidMount() {
    document.body.classList.add('auth');
  }

  componentWillUnmount() {
    document.body.classList.remove('auth');
  }

  onSubmitSuccess = () => {
    callIfFunction(this.props.onSubmitSuccess);
  };

  // NOTE: the text here is duplicated within ``RegisterForm`` on the backend
  render() {
    return (
      <NarrowLayout>
        <p>Pardon the interruption, we just need to get a quick answer from you.</p>

        <ApiForm
          apiMethod="POST"
          apiEndpoint="/users/me/subscriptions/"
          onSubmitSuccess={this.onSubmitSuccess}
          submitLabel="Continue"
        >
          <RadioBooleanField
            p={0}
            inline={false}
            key="subscribed"
            name="subscribed"
            label="Email Updates"
            help={
              <span>
                We'd love to keep you updated via email with product and feature
                announcements, promotions, educational materials, and events. Our updates
                focus on relevant information, and we'll never sell your data to third
                parties. See our <a href="https://sentry.io/privacy/">Privacy Policy</a>{' '}
                for more details.
              </span>
            }
            yesLabel="Yes, I would like to receive updates via email"
            noLabel="No, I'd prefer not to receive these updates"
            required
          />
        </ApiForm>
      </NarrowLayout>
    );
  }
}
