import {ClassNames} from '@emotion/core';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {formFooterClass} from 'app/views/auth/login';
import {t, tct} from 'app/locale';
import ConfigStore from 'app/stores/configStore';
import ExternalLink from 'app/components/links/externalLink';
import Form from 'app/components/forms/form';
import PasswordField from 'app/components/forms/passwordField';
import RadioBooleanField from 'app/components/forms/radioBooleanField';
import SentryTypes from 'app/sentryTypes';
import TextField from 'app/components/forms/textField';

const SubscribeField = () => (
  <RadioBooleanField
    name="subscribe"
    yesLabel={t('Yes, I would like to receive updates via email')}
    noLabel={t("No, I'd prefer not to receive these updates")}
    help={tct(
      `We'd love to keep you updated via email with product and feature
           announcements, promotions, educational materials, and events. Our
           updates focus on relevant information, and we'll never sell your data
           to third parties. See our [link] for more details.`,
      {
        link: <a href="https://sentry.io/privacy/">Privacy Policy</a>,
      }
    )}
  />
);

class RegisterForm extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    authConfig: SentryTypes.AuthConfig,
  };

  state = {
    errorMessage: null,
    errors: {},
  };

  handleSubmit = async (data, onSuccess, onError) => {
    const {api} = this.props;

    try {
      const response = await api.requestPromise('/auth/register/', {
        method: 'POST',
        data,
      });
      onSuccess(data);

      // TODO(epurkhiser): There is more we need to do to setup the user. but
      // definitely primarily we need to init our user.
      ConfigStore.set('user', response.user);

      browserHistory.push({pathname: response.nextUri});
    } catch (e) {
      if (!e.responseJSON || !e.responseJSON.errors) {
        onError(e);
        return;
      }

      let message = e.responseJSON.detail;
      if (e.responseJSON.errors.__all__) {
        message = e.responseJSON.errors.__all__;
      }

      this.setState({
        errorMessage: message,
        errors: e.responseJSON.errors || {},
      });

      onError(e);
    }
  };

  render() {
    const {hasNewsletter} = this.props.authConfig;
    const {errorMessage, errors} = this.state;

    return (
      <ClassNames>
        {({css}) => (
          <Form
            initialData={{subscribe: true}}
            submitLabel={t('Continue')}
            onSubmit={this.handleSubmit}
            footerClass={css`
              ${formFooterClass}
            `}
            errorMessage={errorMessage}
            extraButton={
              <PrivacyPolicyLink href="https://sentry.io/privacy/">
                {t('Privacy Policy')}
              </PrivacyPolicyLink>
            }
          >
            <TextField
              name="name"
              placeholder={t('Jane Bloggs')}
              maxlength={30}
              label={t('Name')}
              error={errors.name}
              required
            />
            <TextField
              name="username"
              placeholder={t('you@example.com')}
              maxlength={128}
              label={t('Email')}
              error={errors.username}
              required
            />
            <PasswordField
              name="password"
              placeholder={t('something super secret')}
              label={t('Password')}
              error={errors.password}
              required
            />
            {hasNewsletter && <SubscribeField />}
          </Form>
        )}
      </ClassNames>
    );
  }
}

const PrivacyPolicyLink = styled(ExternalLink)`
  color: ${p => p.theme.gray500};

  &:hover {
    color: ${p => p.theme.gray800};
  }
`;

export default RegisterForm;
