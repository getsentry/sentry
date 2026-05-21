import {Fragment} from 'react';
import {Navigate} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ApiForm} from 'sentry/components/forms/apiForm';
import {HiddenField} from 'sentry/components/forms/fields/hiddenField';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {NarrowLayout} from 'sentry/components/narrowLayout';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useParams} from 'sentry/utils/useParams';

function OrganizationRestore() {
  const params = useParams<{orgId: string}>();
  return (
    <SentryDocumentTitle title={t('Restore Organization')}>
      <NarrowLayout>
        <h3>{t('Deletion Scheduled')}</h3>
        <OrganizationRestoreBody orgSlug={params.orgId} />
      </NarrowLayout>
    </SentryDocumentTitle>
  );
}

type BodyProps = {
  orgSlug: string;
};

function OrganizationRestoreBody({orgSlug}: BodyProps) {
  const {isPending, isError, data} = useQuery(
    apiOptions.as<Organization>()('/organizations/$organizationIdOrSlug/', {
      path: {organizationIdOrSlug: orgSlug},
      staleTime: 0,
    })
  );
  if (isPending) {
    return <LoadingIndicator />;
  }
  if (isError) {
    return (
      <Alert.Container>
        <Alert variant="danger" showIcon={false}>
          {t('There was an error loading your organization.')}
        </Alert>
      </Alert.Container>
    );
  }
  if (data.status.id === 'active') {
    return <Navigate replace to={normalizeUrl(`/organizations/${orgSlug}/issues/`)} />;
  }
  if (data.status.id === 'pending_deletion') {
    return <RestoreForm organization={data} orgSlug={orgSlug} />;
  }
  return (
    <p>
      {t(
        'Sorry, but this organization is currently in progress of being deleted. No turning back.'
      )}
    </p>
  );
}

type RestoreFormProps = {
  orgSlug: string;
  organization: Organization;
};

function RestoreForm({organization, orgSlug}: RestoreFormProps) {
  const endpoint = getApiUrl('/organizations/$organizationIdOrSlug/', {
    path: {organizationIdOrSlug: orgSlug},
  });
  return (
    <Fragment>
      <ApiForm
        apiEndpoint={endpoint}
        apiMethod="PUT"
        submitLabel={t('Restore Organization')}
        onSubmitSuccess={() => {
          addSuccessMessage(t('Organization Restored'));

          // Use window.location to ensure page reloads
          testableWindowLocation.assign(
            normalizeUrl(`/organizations/${organization.slug}/issues/`)
          );
        }}
        initialData={{cancelDeletion: 1}}
        hideFooter
      >
        <HiddenField name="cancelDeletion" />
        <p>
          {tct('The [name] organization is currently scheduled for deletion.', {
            name: <strong>{organization.slug}</strong>,
          })}
        </p>
        <p>
          {t(
            'Would you like to cancel this process and restore the organization back to the original state?'
          )}
        </p>
        <Container marginBottom="xl">
          <Button data-test-id="form-submit" variant="primary" type="submit">
            {t('Restore Organization')}
          </Button>
        </Container>
      </ApiForm>
      <p>
        {t(
          'Note: Restoration is available until deletion has started. Once it begins, there is no recovering the data that has been removed.'
        )}
      </p>
    </Fragment>
  );
}

export default OrganizationRestore;
