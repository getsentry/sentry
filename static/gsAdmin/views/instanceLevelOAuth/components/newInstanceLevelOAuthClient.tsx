import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';
import {Heading} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

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

const clientSchema = z.object({
  name: z.string().min(1, t('Client name is required')),
  redirectUris: z.string().min(1, t('Redirect URIs are required')),
  allowedOrigins: z.string(),
  homepageUrl: z.string(),
  privacyUrl: z.string(),
  termsUrl: z.string(),
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
    onSubmit: ({value, formApi}) =>
      mutation.mutateAsync(value).catch(error => {
        if (error instanceof RequestError) {
          setFieldErrors(formApi, error);
        }
      }),
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h4">{t('Create New Instance Level OAuth Client')}</Heading>
      </Header>
      <Body>
        <Stack gap="lg">
          <form.AppField name="name">
            {field => (
              <field.Layout.Stack
                label={t('Client Name')}
                hintText={t('Human readable name for the client.')}
                required
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={t('e.g. Sentry')}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="redirectUris">
            {field => (
              <field.Layout.Stack
                label={t('Redirect URIs')}
                hintText={t(
                  'The URLs that users will redirect to after login/signup. Space separated!'
                )}
                required
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={t('e.g. https://sentry.io/')}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="allowedOrigins">
            {field => (
              <field.Layout.Stack
                label={t('Allowed Origins')}
                hintText={t('Allowed origins for the client. Space separated!')}
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={t('e.g. https://sentry.io/')}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="homepageUrl">
            {field => (
              <field.Layout.Stack
                label={t('Homepage URL')}
                hintText={t("Client's homepage")}
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={t('e.g. https://sentry.io/')}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="privacyUrl">
            {field => (
              <field.Layout.Stack
                label={t('Privacy Policy URL')}
                hintText={t("URL to client's privacy policy")}
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={t('e.g. https://sentry.io/privacy/')}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="termsUrl">
            {field => (
              <field.Layout.Stack
                label={t('Terms and Conditions URL')}
                hintText={t("URL to client's terms and conditions")}
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={t('e.g. https://sentry.io/terms/')}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <form.SubmitButton>{t('Create Client')}</form.SubmitButton>
      </Footer>
    </form.AppForm>
  );
}
