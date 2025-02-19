import {useEffect} from 'react';

import ApiForm from 'sentry/components/forms/apiForm';
import {FieldWrapper} from 'sentry/components/forms/fieldGroup/fieldWrapper';
import RadioField from 'sentry/components/forms/fields/radioField';
import ExternalLink from 'sentry/components/links/externalLink';
import NarrowLayout from 'sentry/components/narrowLayout';
import {t, tct} from 'sentry/locale';

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
        <RadioField
          name="subscribed"
          choices={[
            ['true', t('Yes, I would like to receive updates via email')],
            ['false', t("No, I'd prefer not to receive these updates")],
          ]}
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
        />
      </ApiForm>
    </NarrowLayout>
  );
}

export default NewsletterConsent;
