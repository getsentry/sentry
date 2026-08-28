import {Navigate} from 'react-router-dom';
import {useMutation, useQuery} from '@tanstack/react-query';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {LoadingError} from 'sentry/components/loadingError';
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
  const {isPending, isError, data, error, refetch} = useQuery(
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
      <LoadingError
        message={
          error instanceof RequestError && typeof error.responseJSON?.detail === 'string'
            ? error.responseJSON.detail
            : t('There was an error loading your organization.')
        }
        onRetry={refetch}
      />
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
  const {mutateAsync: restoreOrganization} = useMutation({
    mutationFn: (data: {cancelDeletion: number}) =>
      fetchMutation<Organization>({url: endpoint, method: 'PUT', data}),
    onSuccess: () => {
      addSuccessMessage(t('Organization Restored'));

      // Use window.location to ensure page reloads
      testableWindowLocation.assign(
        normalizeUrl(`/organizations/${organization.slug}/issues/`)
      );
    },
    onError: error => {
      const errorMessage =
        error instanceof RequestError && typeof error.responseJSON?.detail === 'string'
          ? error.responseJSON.detail
          : '';

      addErrorMessage(
        errorMessage
          ? t('Unable to restore organization. %s', errorMessage)
          : t('Unable to restore organization.')
      );
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {cancelDeletion: 1},
    onSubmit: ({value}) => restoreOrganization(value).catch(() => {}),
  });

  return (
    <Stack gap="xl">
      <form.AppForm form={form}>
        <Stack gap="xl" align="start">
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
          <Flex
            width="100%"
            justify="end"
            borderTop="secondary"
            paddingTop="xl"
            paddingBottom="xl"
          >
            <form.SubmitButton>{t('Restore Organization')}</form.SubmitButton>
          </Flex>
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
