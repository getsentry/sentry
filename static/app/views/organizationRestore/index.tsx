import {Navigate} from 'react-router-dom';
import {useMutation, useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {NarrowLayout} from 'sentry/components/narrowLayout';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useParams} from 'sentry/utils/useParams';

function OrganizationRestore() {
  const params = useParams<{orgId: string}>();
  return (
    <SentryDocumentTitle title={t('Restore Organization')}>
      <NarrowLayout>
        <Stack gap="md">
          <Heading as="h3" size="xl">
            {t('Deletion Scheduled')}
          </Heading>
          <OrganizationRestoreBody orgSlug={params.orgId} />
        </Stack>
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
    <Text as="p">
      {t(
        'Sorry, but this organization is currently in progress of being deleted. No turning back.'
      )}
    </Text>
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
  const mutation = useMutation({
    mutationFn: (data: {cancelDeletion: number}) =>
      fetchMutation<Organization>({url: endpoint, method: 'PUT', data}),
    onSuccess: () => {
      clearIndicators();
      addSuccessMessage(t('Organization Restored'));

      // Use window.location to ensure page reloads
      testableWindowLocation.assign(
        normalizeUrl(`/organizations/${organization.slug}/issues/`)
      );
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {cancelDeletion: 1},
    onSubmit: ({value}) => {
      addLoadingMessage(t('Saving changes…'));
      return mutation.mutateAsync(value).catch(() => {
        clearIndicators();
      });
    },
  });

  const errorDetail =
    mutation.error instanceof RequestError
      ? mutation.error.responseJSON?.detail
      : undefined;
  const errorMessage =
    (typeof errorDetail === 'string' ? errorDetail : errorDetail?.message) ??
    t('Unable to restore organization.');

  return (
    <Stack gap="xl">
      <form.AppForm form={form}>
        <Stack gap="md" align="start">
          <Text as="p">
            {tct('The [name] organization is currently scheduled for deletion.', {
              name: <Text bold>{organization.slug}</Text>,
            })}
          </Text>
          <Text as="p">
            {t(
              'Would you like to cancel this process and restore the organization back to the original state?'
            )}
          </Text>
          {mutation.isError && <Alert variant="danger">{errorMessage}</Alert>}
          <form.SubmitButton data-test-id="form-submit">
            {t('Restore Organization')}
          </form.SubmitButton>
        </Stack>
      </form.AppForm>
      <Text as="p">
        {t(
          'Note: Restoration is available until deletion has started. Once it begins, there is no recovering the data that has been removed.'
        )}
      </Text>
    </Stack>
  );
}

export default OrganizationRestore;
