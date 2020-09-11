import React from 'react';

import {ApiForm, RadioBooleanField} from 'app/components/forms';
import {tct, t} from 'app/locale';
import NarrowLayout from 'app/components/narrowLayout';
import ExternalLink from 'app/components/links/externalLink';

type Props = {
  onSubmitSuccess?: () => void;
};

export default class NewsletterConsent extends React.Component<Props> {
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
        <p>
          {t('Pardon the interruption, we just need to get a quick answer from you.')}
        </p>

        <ApiForm
          apiMethod="POST"
          apiEndpoint="/users/me/subscriptions/"
          onSubmitSuccess={() => this.props.onSubmitSuccess?.()}
          submitLabel={t('Continue')}
        >
          <RadioBooleanField
            key="subscribed"
            name="subscribed"
            label={t('Email Updates')}
            help={
              <span>
                {tct(
                  `We'd love to keep you updated via email with product and feature
                   announcements, promotions, educational materials, and events. Our updates
                   focus on relevant information, and we'll never sell your data to third
                   parties. See our [link:Privacy Policy] for more details.
                   `,
                  {link: <ExternalLink href="https://sentry.io/privacy/" />}
                )}
              </span>
            }
            yesLabel={t('Yes, I would like to receive updates via email')}
            noLabel={t("No, I'd prefer not to receive these updates")}
            required
          />
        </ApiForm>
      </NarrowLayout>
    );
  }
}
