import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';
import {Heading} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';
import {safeURL} from 'sentry/utils/url/safeURL';

import {ClientSecretModal} from './clientSecretModal';

type ClientFormValues = {
  allowedOrigins: string;
  homepageUrl: string;
  name: string;
  privacyUrl: string;
  redirectUris: string;
  termsUrl: string;
};

type ClientResponse = {
  clientID: string;
  clientSecret: string;
};

const urlValidation = z
  .string()
  .min(1, 'Field is required')
  .pipe(z.string().refine(value => Boolean(safeURL(value)), 'Enter a valid URL'));

const optionalUrlValidation = z
  .string()
  .refine(value => value === '' || Boolean(safeURL(value)), 'Enter a valid URL');

function spaceSeparatedUrls(requiredMessage: string, invalidMessage: string) {
  return z
    .string()
    .trim()
    .min(1, requiredMessage)
    .refine(
      value =>
        value === '' ||
        value.split(/\s+/).every(url => urlValidation.safeParse(url).success),
      invalidMessage
    );
}

function optionalSpaceSeparatedUrls(invalidMessage: string) {
  return z
    .string()
    .trim()
    .refine(
      value =>
        value === '' ||
        value.split(/\s+/).every(url => urlValidation.safeParse(url).success),
      invalidMessage
    );
}

const clientSchema = z.object({
  name: z.string().trim().min(1, 'Client name is required'),
  redirectUris: spaceSeparatedUrls(
    'Redirect URIs are required',
    'Enter valid redirect URLs separated by spaces'
  ),
  allowedOrigins: optionalSpaceSeparatedUrls(
    'Enter valid allowed origins separated by spaces'
  ),
  homepageUrl: optionalUrlValidation,
  privacyUrl: optionalUrlValidation,
  termsUrl: optionalUrlValidation,
});

export function NewInstanceLevelOAuthClient({Body, Footer, Header}: ModalRenderProps) {
  const {openModal} = useModal();

  const mutation = useMutation({
    mutationFn: (data: ClientFormValues) =>
      fetchMutation<ClientResponse>({
        url: getApiUrl('/_admin/instance-level-oauth/'),
        method: 'POST',
        data,
      }),
    onSuccess: data => {
      openModal(deps => (
        <ClientSecretModal
          {...deps}
          clientSecret={data.clientSecret}
          clientID={data.clientID}
        />
      ));
    },
    onError: error => {
      if (
        error instanceof RequestError &&
        setFieldErrors(form, requestErrorToFieldErrors(error, form.state.values))
      ) {
        return;
      }
      addErrorMessage('Unable to create OAuth client.');
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      name: '',
      redirectUris: '',
      allowedOrigins: '',
      homepageUrl: '',
      privacyUrl: '',
      termsUrl: '',
    } satisfies ClientFormValues,
    validators: {onDynamic: clientSchema},
    onSubmit: ({value}) =>
      mutation.mutateAsync(clientSchema.parse(value)).catch(() => {}),
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h4">Create New Instance Level OAuth Client</Heading>
      </Header>
      <Body>
        <Stack gap="lg">
          <form.AppField name="name">
            {field => (
              <field.Layout.Stack
                label="Client Name"
                hintText="Human readable name for the client."
                required
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="e.g. Sentry"
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="redirectUris">
            {field => (
              <field.Layout.Stack
                label="Redirect URIs"
                hintText="The URLs that users will redirect to after login/signup. Space separated!"
                required
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="e.g. https://sentry.io/"
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="allowedOrigins">
            {field => (
              <field.Layout.Stack
                label="Allowed Origins"
                hintText="Allowed origins for the client. Space separated!"
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="e.g. https://sentry.io/"
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="homepageUrl">
            {field => (
              <field.Layout.Stack label="Homepage URL" hintText="Client's homepage">
                <field.Input
                  type="url"
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="e.g. https://sentry.io/"
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
                  type="url"
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="e.g. https://sentry.io/privacy/"
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
                  type="url"
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="e.g. https://sentry.io/terms/"
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <form.SubmitButton>Create Client</form.SubmitButton>
      </Footer>
    </form.AppForm>
  );
}
