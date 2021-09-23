import {Component} from 'react';

import ExternalLink from 'app/components/links/externalLink';
import NarrowLayout from 'app/components/narrowLayout';
import {t, tct} from 'app/locale';
import {ApiForm, InputField} from 'app/views/settings/components/forms';
import RadioBoolean from 'app/views/settings/components/forms/controls/radioBoolean';

type Props = {
  onSubmitSuccess?: () => void;
};

export default class NewsletterConsent extends Component<Props> {
  componentDidMount() {
    document.body.classList.add('auth');
  }

  componentWillUnmount() {
    document.body.classList.remove('auth');
  }

  // NOTE: the text here is duplicated within ``RegisterForm`` on the backend
  render() {
    return (
      <NarrowLayout>
        <ApiForm
          apiMethod="POST"
          apiEndpoint="/users/me/subscriptions/"
          onSubmitSuccess={() => this.props.onSubmitSuccess?.()}
          submitLabel={t('Continue')}
        >
          <p>
            {t('Pardon the interruption, we just need to get a quick answer from you.')}
          </p>
          <InputField
            name="subscribed"
            key="subscribed"
            label={t('Email Updates')}
            required
            inline={false}
            help={tct(
              `We'd love to keep you updated via email with product and feature
               announcements, promotions, educational materials, and events. Our updates
               focus on relevant information, and we'll never sell your data to third
               parties. See our [link:Privacy Policy] for more details.
               `,
              {link: <ExternalLink href="https://sentry.io/privacy/" />}
            )}
            field={fieldProps => (
              <RadioBoolean
                {...fieldProps}
                label={t('Email Updates')}
                yesLabel={t('Yes, I would like to receive updates via email')}
                noLabel={t("No, I'd prefer not to receive these updates")}
              />
            )}
          />
        </ApiForm>
      </NarrowLayout>
    );
  }
}
