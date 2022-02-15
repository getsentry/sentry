import {Component} from 'react';
import {browserHistory} from 'react-router';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import {Client} from 'sentry/api';
import Form from 'sentry/components/deprecatedforms/form';
import PasswordField from 'sentry/components/deprecatedforms/passwordField';
import RadioBooleanField from 'sentry/components/deprecatedforms/radioBooleanField';
import TextField from 'sentry/components/deprecatedforms/textField';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {AuthConfig} from 'sentry/types';
import {formFooterClass} from 'sentry/views/auth/login';

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

type Props = {
  api: Client;
  authConfig: AuthConfig;
};

type State = {
  errorMessage: null | string;
  errors: Record<string, string>;
};

class RegisterForm extends Component<Props, State> {
  state: State = {
    errorMessage: null,
    errors: {},
  };

  handleSubmit: Form['props']['onSubmit'] = async (data, onSuccess, onError) => {
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
              label={t('Name')}
              error={errors.name}
              required
            />
            <TextField
              name="username"
              placeholder={t('you@example.com')}
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
  color: ${p => p.theme.gray300};

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

export default RegisterForm;
