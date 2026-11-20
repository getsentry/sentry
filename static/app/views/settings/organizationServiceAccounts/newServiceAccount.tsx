import {Fragment} from 'react';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {getServiceAccountsUrl, getServiceAccountUrl} from './paths';
import {useCreateServiceAccount} from './serviceAccountApi';
import {ServiceAccountForm, useServiceAccountFormValues} from './serviceAccountForm';

export default function NewServiceAccount() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const createAccount = useCreateServiceAccount(organization);
  const defaultValues = useServiceAccountFormValues();
  return (
    <Fragment>
      <SentryDocumentTitle title={t('New Service Account')} orgSlug={organization.slug} />
      <SettingsPageHeader title={t('New Service Account')} />
      <ServiceAccountForm
        defaultValues={defaultValues}
        submitLabel={t('Create Service Account')}
        onCancel={() => navigate(getServiceAccountsUrl(organization.slug))}
        onSubmit={async input => {
          const account = await createAccount.mutateAsync(input);
          navigate(getServiceAccountUrl(organization.slug, account.id));
        }}
      />
    </Fragment>
  );
}
