import {useCallback} from 'react';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {
  defaultFormOptions,
  FormSearch,
  setFieldErrors,
  useScrapsForm,
} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {
  PROVIDER_TO_SETUP_WEBHOOK_URL,
  WebhookProviderEnum,
} from 'sentry/components/events/featureFlags/utils';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {fetchMutation, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {
  makeFetchSecretQueryKey,
  type Secret,
} from 'sentry/views/settings/featureFlags/changeTracking';

const schema = z.object({
  provider: z.enum(WebhookProviderEnum, t('Provider is required')),
  secret: z.string().min(1, t('Secret is required')).max(100),
});

interface Props {
  canSaveSecret: boolean;
  onCreatedSecret: (secret: string) => void;
  setError: (error: string | null) => void;
  setSelectedProvider: (provider: WebhookProviderEnum) => void;
  existingSecret?: Secret;
}

export default function NewProviderForm({
  onCreatedSecret,
  setSelectedProvider,
  setError,
  canSaveSecret,
  existingSecret,
}: Props) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleGoBack = useCallback(() => {
    navigate(
      normalizeUrl(`/settings/${organization.slug}/feature-flags/change-tracking/`)
    );
  }, [organization.slug, navigate]);

  const mutation = useMutation<string, RequestError, z.infer<typeof schema>>({
    mutationFn: ({provider, secret}) => {
      addLoadingMessage();
      return fetchMutation({
        url: `/organizations/${organization.slug}/flags/signing-secrets/`,
        method: 'POST',
        data: {
          provider: provider.toLowerCase(),
          secret,
        },
      });
    },
    onSuccess: (_response, {secret, provider}) => {
      addSuccessMessage(t('Added provider and secret.'));
      onCreatedSecret(secret);
      setSelectedProvider(provider);
      queryClient.invalidateQueries({
        queryKey: makeFetchSecretQueryKey({orgSlug: organization.slug}),
      });
    },
    onError: error => {
      clearIndicators();
      const responseJSON = error.responseJSON;
      const hasFieldSpecificErrors = responseJSON?.secret || responseJSON?.provider;

      if (!hasFieldSpecificErrors) {
        const message =
          typeof responseJSON === 'string'
            ? responseJSON
            : t('Failed to add provider or secret.');
        handleXhrErrorResponse(message, error);
        setError(message);
      }
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {provider: '' as WebhookProviderEnum, secret: ''},
    validators: {onDynamic: schema},
    onSubmit: ({value, formApi}) => {
      return mutation.mutateAsync(value).catch((error: RequestError) => {
        const responseJSON = error.responseJSON;
        if (responseJSON?.secret || responseJSON?.provider) {
          const extractMessage = (val: unknown): string => {
            if (Array.isArray(val)) {
              return typeof val[0] === 'string' ? val[0] : JSON.stringify(val[0]);
            }
            return typeof val === 'string' ? val : JSON.stringify(val);
          };
          const errors: Record<string, {message: string}> = {};
          if (responseJSON.secret) {
            errors.secret = {message: extractMessage(responseJSON.secret)};
          }
          if (responseJSON.provider) {
            errors.provider = {message: extractMessage(responseJSON.provider)};
          }
          setFieldErrors(formApi, errors);
        }
      });
    },
  });

  return (
    <FormSearch route="/settings/feature-flags/change-tracking/new-provider/">
      <form.AppForm form={form}>
        <form.AppField name="provider">
          {field => (
            <div>
              <field.Layout.Row
                padding="xl"
                label={t('Provider')}
                hintText={t(
                  'If you have already linked this provider, pasting a new secret will override the existing secret.'
                )}
                required
              >
                <field.Select
                  value={field.state.value}
                  onChange={value => {
                    field.handleChange(value);
                    setSelectedProvider(value);
                  }}
                  placeholder={t('Select a provider')}
                  options={Object.values(WebhookProviderEnum).map(p => ({
                    value: p,
                    label: p,
                  }))}
                />
              </field.Layout.Row>
              <WebhookUrlField
                provider={field.state.value}
                organizationSlug={organization.slug}
              />
            </div>
          )}
        </form.AppField>
        <form.AppField name="secret">
          {field => (
            <field.Layout.Row
              padding="xl"
              label={t('Secret')}
              hintText={t(
                'Paste the signing secret given by your provider when creating the webhook.'
              )}
              required
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                maxLength={100}
              />
            </field.Layout.Row>
          )}
        </form.AppField>
        <Flex justify="end" gap="md" padding="xl">
          <Button onClick={handleGoBack}>{t('Cancel')}</Button>
          <form.SubmitButton disabled={!canSaveSecret}>
            {existingSecret ? t('Update Provider') : t('Add Provider')}
          </form.SubmitButton>
        </Flex>
      </form.AppForm>
    </FormSearch>
  );
}

function WebhookUrlField({
  provider,
  organizationSlug,
}: {
  organizationSlug: string;
  provider: WebhookProviderEnum | '';
}) {
  const setupUrl = provider === '' ? undefined : PROVIDER_TO_SETUP_WEBHOOK_URL[provider];

  return (
    <Flex direction="row" gap="sm" align="center" justify="between" padding="xl">
      <Stack width="50%" gap="xs">
        <Text>{t('Webhook URL')}</Text>
        <Text size="sm" variant="muted">
          {setupUrl
            ? tct(
                "Create a webhook integration with your [link:feature flag service]. When you do so, you'll need to enter this URL.",
                {
                  link: <ExternalLink href={setupUrl} />,
                }
              )
            : t(
                "Create a webhook integration with your feature flag service. When you do so, you'll need to enter this URL."
              )}
        </Text>
      </Stack>
      <Container flexGrow={1}>
        <TextCopyInput aria-label={t('Webhook URL')} disabled={!provider}>
          {provider
            ? `${window.location.origin}/api/0/organizations/${organizationSlug}/flags/hooks/provider/${provider.toLowerCase()}/`
            : ''}
        </TextCopyInput>
      </Container>
    </Flex>
  );
}
