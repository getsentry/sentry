import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {getServiceAccountUrl} from './paths';
import {serviceAccountApiOptions, useUpdateServiceAccount} from './serviceAccountApi';
import {ServiceAccountForm, useServiceAccountFormValues} from './serviceAccountForm';
import type {ServiceAccount} from './types';
import {useCannotManageReason} from './useServiceAccountAccess';

function EditServiceAccountForm({account}: {account: ServiceAccount}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const updateAccount = useUpdateServiceAccount(organization, account.id);
  const defaultValues = useServiceAccountFormValues(account);
  const cannotManageReason = useCannotManageReason(account);

  const detailsUrl = getServiceAccountUrl(organization.slug, account.id);

  if (cannotManageReason) {
    return (
      <Alert.Container>
        <Alert variant="warning">{cannotManageReason}</Alert>
      </Alert.Container>
    );
  }

  return (
    <ServiceAccountForm
      defaultValues={defaultValues}
      submitLabel={t('Save Changes')}
      onCancel={() => navigate(detailsUrl)}
      onSubmit={async input => {
        await updateAccount.mutateAsync(input);
        navigate(detailsUrl);
      }}
    />
  );
}

export default function EditServiceAccount() {
  const organization = useOrganization();
  const {serviceAccountId} = useParams<{serviceAccountId: string}>();
  const {
    data: account,
    isPending,
    isError,
    refetch,
  } = useQuery(serviceAccountApiOptions(organization, serviceAccountId));

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
        breadcrumbs={[
          {
            type: 'link',
            label: account.name,
            to: getServiceAccountUrl(organization.slug, account.id),
          },
        ]}
      />
      <EditServiceAccountForm account={account} />
    </Fragment>
  );
}
