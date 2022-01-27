import {useEffect} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import NarrowLayout from 'sentry/components/narrowLayout';
import {t, tct} from 'sentry/locale';
import {ApiForm, InputField} from 'sentry/views/settings/components/forms';
import RadioBoolean from 'sentry/views/settings/components/forms/controls/radioBoolean';
import FieldWrapper from 'sentry/views/settings/components/forms/field/fieldWrapper';

type Props = {
  onSubmitSuccess?: () => void;
};

function NewsletterConsent({onSubmitSuccess}: Props) {
  useEffect(() => {
    document.body.classList.add('auth');

    return () => document.body.classList.remove('auth');
  }, []);

  // NOTE: the text here is duplicated within ``RegisterForm`` on the backend
  return (
    <NarrowLayout>
      <ApiForm
        apiMethod="POST"
        apiEndpoint="/users/me/subscriptions/"
        onSubmitSuccess={onSubmitSuccess}
        submitLabel={t('Continue')}
      >
        <FieldWrapper stacked={false} hasControlState={false}>
          {t('Pardon the interruption, we just need to get a quick answer from you.')}
        </FieldWrapper>
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

export default NewsletterConsent;
