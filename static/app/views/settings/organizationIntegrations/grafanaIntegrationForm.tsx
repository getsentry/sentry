import {useMutation, type UseMutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';

type GrafanaConfig = {token: string; url: string};

const configSchema = z.object({
  url: z.string().trim().min(1, t('Grafana URL is required')).max(255),
  token: z.string().trim().max(255),
});

export function GrafanaIntegrationForm({
  initialUrl,
  mutationOptions,
}: {
  initialUrl: string;
  mutationOptions: UseMutationOptions<unknown, Error, GrafanaConfig>;
}) {
  const mutation = useMutation(mutationOptions);
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {url: initialUrl, token: ''},
    validators: {onDynamic: configSchema},
    onSubmit: ({value}) =>
      mutation
        .mutateAsync(configSchema.parse(value))
        .then(() => {
          form.reset();
          addSuccessMessage(t('Grafana connection saved'));
        })
        .catch(error => {
          if (error instanceof RequestError) {
            setFieldErrors(form, requestErrorToFieldErrors(error, form.state.values));
          }
        }),
  });

  return (
    <form.AppForm form={form}>
      <Stack gap="lg">
        {mutation.error && (
          <Alert variant="danger" role="alert">
            {getRequestErrorUserMessage(mutation.error)}
          </Alert>
        )}
        <form.AppField name="url">
          {field => (
            <field.Layout.Row
              label={t('Grafana URL')}
              hintText={t(
                'Your Grafana Cloud stack URL, like https://your-stack.grafana.net.'
              )}
              required
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                disabled={mutation.isPending}
              />
            </field.Layout.Row>
          )}
        </form.AppField>
        <form.AppField name="token">
          {field => (
            <field.Layout.Row
              label={t('Service account token')}
              hintText={t(
                'Leave blank to keep the current token. When changing stacks, enter a token for the new stack.'
              )}
            >
              <field.Password
                value={field.state.value}
                onChange={field.handleChange}
                autoComplete="new-password"
                disabled={mutation.isPending}
              />
            </field.Layout.Row>
          )}
        </form.AppField>
        <Flex justify="end">
          <form.SubmitButton>{t('Save and test')}</form.SubmitButton>
        </Flex>
      </Stack>
    </form.AppForm>
  );
}
