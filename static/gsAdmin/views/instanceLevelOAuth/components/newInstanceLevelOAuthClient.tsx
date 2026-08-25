import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';
import {Heading} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

import {ClientSecretModal} from './clientSecretModal';

type ClientFormValues = {
  allowedOrigins: string;
  name: string;
  redirectUris: string;
  homepageUrl?: string;
  privacyUrl?: string;
  termsUrl?: string;
};

type ClientResponse = {
  clientID: string;
  clientSecret: string;
};

const urlSchema = z.url();
const optionalUrlSchema = z
  .url('Enter a valid URL')
  .or(z.literal(''))
  .transform(value => value || undefined);

const clientSchema = z.object({
  name: z.string().trim().min(1, 'Client name is required'),
  redirectUris: z
    .string()
    .trim()
    .min(1, 'Redirect URIs are required')
    .refine(
      value =>
        value === '' || value.split(/\s+/).every(url => urlSchema.safeParse(url).success),
      {
        message: 'Enter valid redirect URLs separated by spaces',
      }
    ),
  allowedOrigins: z
    .string()
    .trim()
    .min(1, 'Allowed origins are required')
    .refine(
      value =>
        value === '' ||
        value.split(/\s+/).every(origin => urlSchema.safeParse(origin).success),
      {message: 'Enter valid allowed origins separated by spaces'}
    ),
  homepageUrl: optionalUrlSchema,
  privacyUrl: optionalUrlSchema,
  termsUrl: optionalUrlSchema,
});

export function NewInstanceLevelOAuthClient({Body, Footer, Header}: ModalRenderProps) {
  const {openModal} = useModal();

  const mutation = useMutation({
    mutationFn: (data: ClientFormValues) =>
      fetchMutation<ClientResponse>({
        url: '/_admin/instance-level-oauth/',
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
      if (error instanceof RequestError) {
        setFieldErrors(form, error);
      } else {
        addErrorMessage('Unable to create OAuth client.');
      }
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
          <form.AppField name="homepageUrl">
            {field => (
              <field.Layout.Stack label="Homepage URL" hintText="Client's homepage">
                <field.Input
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
