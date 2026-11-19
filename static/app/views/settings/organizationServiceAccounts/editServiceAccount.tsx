import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {serviceAccountOptions, useUpdateServiceAccount} from './mockServiceAccountApi';
import {getDefaultValues, ServiceAccountForm} from './serviceAccountForm';
import {useServiceAccountAccess} from './useServiceAccountAccess';

export default function EditServiceAccount() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {serviceAccountId} = useParams<{serviceAccountId: string}>();
  const {hasGlobalRole} = useServiceAccountAccess();
  const {
    data: account,
    isPending,
    isError,
    refetch,
  } = useQuery(serviceAccountOptions(serviceAccountId));
  const updateAccount = useUpdateServiceAccount(serviceAccountId);

  const detailsPath = `/settings/${organization.slug}/service-accounts/${serviceAccountId}/`;

  if (isError) {
    return (
      <LoadingError message={t('Failed to load service account.')} onRetry={refetch} />
    );
  }
  if (isPending) {
    return <LoadingIndicator />;
  }

  return (
    <Fragment>
      <SentryDocumentTitle
        title={t('Edit %s', account.name)}
        orgSlug={organization.slug}
      />
      <SettingsPageHeader
        title={t('Edit')}
        breadcrumbs={[{type: 'link', label: account.name, to: detailsPath}]}
      />
      <ServiceAccountForm
        defaultValues={getDefaultValues(account, {hasGlobalRole})}
        submitLabel={t('Save Changes')}
        onCancel={() => navigate(detailsPath)}
        onSubmit={async input => {
          await updateAccount.mutateAsync(input);
          navigate(detailsPath);
        }}
      />
    </Fragment>
  );
}
