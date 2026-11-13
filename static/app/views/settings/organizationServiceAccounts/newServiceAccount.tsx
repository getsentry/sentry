import {Fragment} from 'react';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {useCreateServiceAccount} from './mockServiceAccountApi';
import {getDefaultValues, ServiceAccountForm} from './serviceAccountForm';
import {useServiceAccountAccess} from './useServiceAccountAccess';

export default function NewServiceAccount() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const user = useUser();
  const {hasGlobalRole} = useServiceAccountAccess();
  const createAccount = useCreateServiceAccount({createdBy: user.name});

  const basePath = `/settings/${organization.slug}/service-accounts/`;

  return (
    <Fragment>
      <SentryDocumentTitle title={t('New Service Account')} orgSlug={organization.slug} />
      <SettingsPageHeader title={t('New Service Account')} />
      <ServiceAccountForm
        defaultValues={getDefaultValues(undefined, {hasGlobalRole})}
        submitLabel={t('Create Service Account')}
        onCancel={() => navigate(basePath)}
        onSubmit={async input => {
          const account = await createAccount.mutateAsync(input);
          navigate(`${basePath}${account.id}/`);
        }}
      />
    </Fragment>
  );
}
