import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {NarrowLayout} from 'sentry/components/narrowLayout';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation, useApiQuery} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {useLocation} from 'sentry/utils/useLocation';

type TransferDetails = {
  organizations: Organization[];
  project: Project;
};

const schema = z.object({
  organization: z
    .string()
    .nullable()
    .refine(value => value !== null, t('Please select an organization')),
});

// Because this route happens outside of OrganizationContext we need to use
// initial data to decide which host to send the request to as
// `/accept-transfer/` cannot be resolved to a region.
function getRegionHost(): string | undefined {
  const initialData = window.__initialData;
  if (initialData && initialData.links?.regionUrl !== initialData.links?.sentryUrl) {
    return initialData.links.regionUrl;
  }
  return undefined;
}

interface TransferFormProps {
  regionHost: string | undefined;
  transferData: unknown;
  transferDetails: TransferDetails;
}

function AcceptProjectTransferForm({
  transferDetails,
  transferData,
  regionHost,
}: TransferFormProps) {
  const options = transferDetails.organizations.map(org => ({
    label: org.slug,
    value: org.slug,
  }));

  const {mutateAsync: submitTransfer} = useMutation({
    mutationFn: (payload: {data: unknown; organization: string}) =>
      fetchMutation({
        method: 'POST',
        url: '/accept-transfer/',
        data: payload,
        options: {host: regionHost},
      }),
    onSuccess: (_data, payload) => {
      const orgSlug = payload.organization;
      const projectSlug = transferDetails.project.slug;
      const sentryUrl = ConfigStore.get('links').sentryUrl;
      if (projectSlug) {
        // done this way since we need to change subdomains
        testableWindowLocation.assign(
          `${sentryUrl}/organizations/${orgSlug}/settings/projects/${projectSlug}/teams/`
        );
      } else {
        testableWindowLocation.assign(`${sentryUrl}/organizations/${orgSlug}/projects/`);
      }
    },
    onError: error => {
      const errorMsg =
        error instanceof RequestError && typeof error.responseJSON?.detail === 'string'
          ? error.responseJSON.detail
          : '';

      addErrorMessage(
        errorMsg
          ? t('Unable to transfer project. %s', errorMsg)
          : t('Unable to transfer project.')
      );
    },
  });

  // z.input accepts null; z.output (after refine) does not
  const defaultValues: z.input<typeof schema> = {
    organization: options[0]?.value ?? null,
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      // schema.parse validates and narrows null away
      const {organization} = schema.parse(value);
      return submitTransfer({data: transferData, organization}).catch(() => {});
    },
  });

  return (
    <form.AppForm form={form}>
      <Stack gap="xl">
        <form.AppField name="organization">
          {field => (
            <field.Layout.Stack label={t('Organization')} required>
              <field.Select
                value={field.state.value}
                onChange={field.handleChange}
                options={options}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <Flex justify="end" borderTop="secondary" paddingTop="xl" paddingBottom="xl">
          <form.SubmitButton variant="danger">{t('Transfer Project')}</form.SubmitButton>
        </Flex>
      </Stack>
    </form.AppForm>
  );
}

function AcceptProjectTransfer() {
  const location = useLocation();

  const {
    data: transferDetails,
    isPending,
    isError,
    error,
    refetch,
  } = useApiQuery<TransferDetails>(
    [getApiUrl('/accept-transfer/'), {query: location.query, host: getRegionHost()}],
    {
      staleTime: 0,
    }
  );

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <LoadingError
        message={
          typeof error?.responseJSON?.detail === 'string'
            ? error.responseJSON.detail
            : undefined
        }
        onRetry={refetch}
      />
    );
  }

  return (
    <NarrowLayout>
      <SentryDocumentTitle title={t('Accept Project Transfer')} />
      <Stack gap="xl">
        <Stack gap="md">
          <Heading as="h3" size="xl">
            {t('Approve Transfer Project Request')}
          </Heading>
          <Text as="p">
            {tct(
              'Projects must be transferred to a specific [organization]. You can grant specific teams access to the project later under the [projectSettings]. (Note that granting access to at least one team is necessary for the project to appear in all parts of the UI.)',
              {
                organization: <strong>{t('Organization')}</strong>,
                projectSettings: <strong>{t('Project Settings')}</strong>,
              }
            )}
          </Text>
          <Text as="p">
            {tct(
              'Please select which [organization] you want for the project [project].',
              {
                organization: <strong>{t('Organization')}</strong>,
                project: transferDetails.project.slug,
              }
            )}
          </Text>
        </Stack>
        <AcceptProjectTransferForm
          transferDetails={transferDetails}
          transferData={location.query.data}
          regionHost={getRegionHost()}
        />
      </Stack>
    </NarrowLayout>
  );
}

export default AcceptProjectTransfer;
