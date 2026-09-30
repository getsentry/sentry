import {Fragment, useEffect} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getFormattedDate} from 'sentry/utils/dates';
import {fetchMutation} from 'sentry/utils/queryClient';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
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
  name: z.string().min(1),
  redirectUris: z
    .string()
    .trim()
    .min(1)
    .refine(
      value => value.split(/\s+/).every(url => z.url().safeParse(url).success),
      'Enter valid redirect URLs separated by spaces'
    ),
  allowedOrigins: z
    .string()
    .trim()
    .refine(
      value =>
        value === '' || value.split(/\s+/).every(url => z.url().safeParse(url).success),
      'Enter valid allowed origins separated by spaces'
    ),
  homepageUrl: optionalUrlValidation,
  privacyUrl: optionalUrlValidation,
  termsUrl: optionalUrlValidation,
});

const fields = [
  {
    name: 'clientID' as const,
    label: 'Client ID',
    hintText: 'ID of the selected client (not modifiable)',
    disabled: true,
  },
  {
    name: 'name' as const,
    label: 'Client Name',
    hintText: 'Human readable name for the client',
    placeholder: 'e.g. CodeCov',
    required: true,
  },
  {
    name: 'redirectUris' as const,
    label: 'Redirect URIs (space separated)',
    hintText: 'The URL that users will redirect to after login/signup',
    placeholder: 'e.g. https://notsentry.io/redirect',
    required: true,
  },
  {
    name: 'allowedOrigins' as const,
    label: 'Allowed Origins (space separated)',
    hintText: 'Allowed origins for the client',
    placeholder: 'e.g. https://notsentry.io/origin',
  },
  {
    name: 'homepageUrl' as const,
    label: 'Homepage URL',
    hintText: "Client's homepage",
    placeholder: 'e.g. https://notsentry.io/home',
  },
  {
    name: 'privacyUrl' as const,
    label: 'Privacy Policy URL',
    hintText: "URL to client's privacy policy",
    placeholder: 'e.g. https://notsentry.io/privacy',
  },
  {
    name: 'termsUrl' as const,
    label: 'Terms and Conditions URL',
    hintText: "URL to client's terms and conditions",
    placeholder: 'e.g. https://notsentry.io/terms',
  },
];

function ClientDetailsForm({clientDetails}: {clientDetails: ClientDetails}) {
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof clientSchema>) =>
      fetchMutation({
        url: getApiUrl('/_admin/instance-level-oauth/$clientId/', {
          path: {clientId: clientDetails.clientID ?? ''},
        }),
        method: 'PUT',
        data,
      }),
    onSuccess: () => testableWindowLocation.reload(),
    onError: () => addErrorMessage('Unable to update client settings.'),
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
        {fields.map(fieldConfig => (
          <form.AppField key={fieldConfig.name} name={fieldConfig.name}>
            {field => (
              <field.Layout.Stack
                label={fieldConfig.label}
                hintText={fieldConfig.hintText}
                required={fieldConfig.required}
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={fieldConfig.placeholder}
                  disabled={fieldConfig.disabled || mutation.isPending}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        ))}
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
  const {data, isPending, isError} = useQuery({
    ...apiOptions.as<ClientDetailsResponse>()('/_admin/instance-level-oauth/$clientId/', {
      path: {clientId: params.clientID},
      staleTime: 0,
    }),
    retry: false,
  });

  useEffect(() => {
    if (isError) {
      addErrorMessage('Unable to load client data');
    }
  }, [isError]);

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
