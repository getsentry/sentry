import {Fragment} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getFormattedDate} from 'sentry/utils/dates';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';
import {useParams} from 'sentry/utils/useParams';

import {PageHeader} from 'admin/components/pageHeader';

import {ConfirmClientDeleteModal} from './components/confirmClientDeleteModal';

type ClientDetails = {
  allowedOrigins: string | null;
  clientID: string | null;
  createdAt: string | null;
  homepageUrl: string | null;
  id: string | null;
  name: string | null;
  privacyUrl: string | null;
  redirectUris: string | null;
  termsUrl: string | null;
};

type ClientDetailsResponse = {
  allowedOrigins: string[];
  clientID: string | null;
  dateAdded: string;
  homepageUrl: string | null;
  id: string | null;
  name: string | null;
  privacyUrl: string | null;
  redirectUris: string[];
  termsUrl: string | null;
};

const optionalUrlValidation = z.url('Enter a valid URL').or(z.literal(''));

const clientSchema = z.object({
  clientID: z.string(),
  name: z.string().trim().min(1, 'Client name is required'),
  redirectUris: z
    .string()
    .trim()
    .min(1, 'Redirect URIs are required')
    .refine(
      value =>
        value === '' ||
        (!value.includes(',') &&
          value.split(/\s+/).every(url => z.url().safeParse(url).success)),
      'Enter valid redirect URLs separated by spaces'
    ),
  allowedOrigins: z
    .string()
    .trim()
    .refine(
      value =>
        value === '' ||
        (!value.includes(',') &&
          value.split(/\s+/).every(url => z.url().safeParse(url).success)),
      'Enter valid allowed origins separated by spaces'
    ),
  homepageUrl: optionalUrlValidation,
  privacyUrl: optionalUrlValidation,
  termsUrl: optionalUrlValidation,
});

function clientDetailsQueryOptions(clientID: string) {
  return apiOptions.as<ClientDetailsResponse>()(
    '/_admin/instance-level-oauth/$clientId/',
    {
      path: {clientId: clientID},
      staleTime: 0,
    }
  );
}

function ClientDetailsForm({clientDetails}: {clientDetails: ClientDetails}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof clientSchema>) =>
      fetchMutation({
        url: getApiUrl('/_admin/instance-level-oauth/$clientId/', {
          path: {clientId: clientDetails.clientID ?? ''},
        }),
        method: 'PUT',
        data,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: clientDetailsQueryOptions(clientDetails.clientID ?? '').queryKey,
      }),
    onError: error => {
      if (
        error instanceof RequestError &&
        setFieldErrors(form, requestErrorToFieldErrors(error, form.state.values))
      ) {
        return;
      }
      addErrorMessage('Unable to update client settings.');
    },
  });
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      clientID: clientDetails.clientID ?? '',
      name: clientDetails.name ?? '',
      redirectUris: clientDetails.redirectUris ?? '',
      allowedOrigins: clientDetails.allowedOrigins ?? '',
      homepageUrl: clientDetails.homepageUrl ?? '',
      privacyUrl: clientDetails.privacyUrl ?? '',
      termsUrl: clientDetails.termsUrl ?? '',
    },
    validators: {onDynamic: clientSchema},
    onSubmit: ({value}) => mutation.mutateAsync(value).catch(() => {}),
  });
  return (
    <form.AppForm form={form}>
      <Stack gap="lg">
        <form.AppField name="clientID">
          {field => (
            <field.Layout.Stack
              label="Client ID"
              hintText="ID of the selected client (not modifiable)"
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                disabled
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="name">
          {field => (
            <field.Layout.Stack
              label="Client Name"
              hintText="Human readable name for the client"
              required
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="e.g. CodeCov"
                disabled={mutation.isPending}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="redirectUris">
          {field => (
            <field.Layout.Stack
              label="Redirect URIs (space separated)"
              hintText="The URL that users will redirect to after login/signup"
              required
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="e.g. https://notsentry.io/redirect"
                disabled={mutation.isPending}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="allowedOrigins">
          {field => (
            <field.Layout.Stack
              label="Allowed Origins (space separated)"
              hintText="Allowed origins for the client"
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="e.g. https://notsentry.io/origin"
                disabled={mutation.isPending}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="homepageUrl">
          {field => (
            <field.Layout.Stack label="Homepage URL" hintText="Client's homepage">
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="e.g. https://notsentry.io/home"
                disabled={mutation.isPending}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="privacyUrl">
          {field => (
            <field.Layout.Stack
              label="Privacy Policy URL"
              hintText="URL to client's privacy policy"
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="e.g. https://notsentry.io/privacy"
                disabled={mutation.isPending}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="termsUrl">
          {field => (
            <field.Layout.Stack
              label="Terms and Conditions URL"
              hintText="URL to client's terms and conditions"
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="e.g. https://notsentry.io/terms"
                disabled={mutation.isPending}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <Text as="p">
          <Text bold>Date added:</Text> {clientDetails.createdAt}
        </Text>
        <form.SubmitButton>Save Client Settings</form.SubmitButton>
      </Stack>
    </form.AppForm>
  );
}

export function InstanceLevelOAuthDetails() {
  const {openModal} = useModal();
  const params = useParams<{clientID: string}>();
  const {data, isPending, isError, isFetching, refetch} = useQuery({
    ...clientDetailsQueryOptions(params.clientID),
    retry: false,
  });

  const clientDetails: ClientDetails | null = data
    ? {
        name: data.name,
        id: data.id,
        clientID: data.clientID,
        createdAt: getFormattedDate(data.dateAdded, 'MMM Do YYYY'),
        allowedOrigins: data.allowedOrigins.join(' '),
        homepageUrl: data.homepageUrl,
        redirectUris: data.redirectUris.join(' '),
        privacyUrl: data.privacyUrl,
        termsUrl: data.termsUrl,
      }
    : null;

  return (
    <div>
      {isPending && <LoadingIndicator />}
      {isError && !clientDetails && (
        <Stack gap="md" align="start">
          <Text>Unable to load client data.</Text>
          <Button onClick={() => refetch()} disabled={isFetching}>
            Retry
          </Button>
        </Stack>
      )}
      {clientDetails && (
        <Fragment>
          <PageHeader
            title={`Details For Instance Level OAuth Client: ${clientDetails.name}`}
          />
          <Stack gap="lg">
            <ClientDetailsForm clientDetails={clientDetails} />
            <Flex justify="right">
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  openModal(deps => (
                    <ConfirmClientDeleteModal
                      {...deps}
                      clientID={clientDetails.clientID}
                      name={clientDetails.name}
                    />
                  ))
                }
              >
                Delete client
              </Button>
            </Flex>
          </Stack>
        </Fragment>
      )}
    </div>
  );
}
