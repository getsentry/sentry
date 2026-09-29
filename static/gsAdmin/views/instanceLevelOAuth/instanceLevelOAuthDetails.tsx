import {Fragment, useCallback, useEffect, useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getFormattedDate} from 'sentry/utils/dates';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {useApi} from 'sentry/utils/useApi';
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

const clientSchema = z.object({
  clientID: z.string(),
  name: z.string().min(1),
  redirectUris: z.string().min(1),
  allowedOrigins: z.string(),
  homepageUrl: z.string(),
  privacyUrl: z.string(),
  termsUrl: z.string(),
});

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
        <p>
          <b>Date added:</b> {clientDetails.createdAt}
        </p>
        <Button type="submit" variant="primary">
          Save Client Settings
        </Button>
      </Stack>
    </form.AppForm>
  );
}

export function InstanceLevelOAuthDetails() {
  const {openModal} = useModal();

  const api = useApi();
  const params = useParams<{clientID: string}>();

  const [clientDetails, setClientDetails] = useState<ClientDetails | null>();
  const [errorMessage, setErrorMessage] = useState<string | null>();
  const [loading, setLoading] = useState(true);

  const fetchClientData = useCallback(async () => {
    try {
      const response = await api.requestPromise(
        getApiUrl('/_admin/instance-level-oauth/$clientId/', {
          path: {clientId: params.clientID},
        }),
        {}
      );

      setClientDetails({
        name: response.name,
        id: response.id,
        clientID: response.clientID,
        createdAt: getFormattedDate(response.dateAdded, 'MMM Do YYYY'),
        allowedOrigins: response.allowedOrigins.join(' '),
        homepageUrl: response.homepageUrl,
        redirectUris: response.redirectUris.join(' '),
        privacyUrl: response.privacyUrl,
        termsUrl: response.termsUrl,
      });
    } catch (err) {
      const message = 'Unable to load client data';
      handleXhrErrorResponse(message, err as RequestError);
      addErrorMessage(message);
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [params.clientID, api]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    fetchClientData();
  }, [fetchClientData]);

  return (
    <div>
      {loading && <LoadingIndicator />}
      {clientDetails && (
        <Fragment>
          <PageHeader
            title={`Details For Instance Level OAuth Client: ${clientDetails.name}`}
          />
          <ClientDetailsForm clientDetails={clientDetails} />
          <Flex justify="right" padding="lg 0">
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
        </Fragment>
      )}
      {errorMessage && <p>{errorMessage}</p>}
    </div>
  );
}
