import {useMutation, useQuery} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {MultipleCheckbox} from 'sentry/components/forms/controls/multipleCheckbox';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {API_ACCESS_SCOPES} from 'sentry/constants';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import type {DeprecatedApiKey} from './types';

type RouteParams = {
  apiKey: string;
};

const scopeListSchema = z.array(z.enum(API_ACCESS_SCOPES));
const apiKeySchema = z.object({
  label: z.string(),
  key: z.string(),
  scope_list: scopeListSchema.min(1, t('At least one scope is required')),
  allowed_origins: z.string(),
});

type ApiKeyFormValues = z.infer<typeof apiKeySchema>;

function OrganizationApiKeyDetails() {
  const organization = useOrganization();
  const params = useParams<RouteParams>();
  const navigate = useNavigate();
  const {
    data: apiKey,
    isPending,
    isError,
    refetch,
  } = useQuery(
    apiOptions.as<DeprecatedApiKey>()(
      '/organizations/$organizationIdOrSlug/api-keys/$apiKeyId/',
      {
        path: {organizationIdOrSlug: organization.slug, apiKeyId: params.apiKey},
        staleTime: 0,
      }
    )
  );

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  return (
    <div>
      <SentryDocumentTitle title={t('Edit API Key')} orgSlug={organization.slug} />
      <SettingsPageHeader title={t('Edit API Key')} />
      <OrganizationApiKeyForm
        apiKey={apiKey}
        organizationSlug={organization.slug}
        onCancel={() => navigate(`/settings/${organization.slug}/api-keys/`)}
      />
    </div>
  );
}

function OrganizationApiKeyForm({
  apiKey,
  organizationSlug,
  onCancel,
}: {
  apiKey: DeprecatedApiKey;
  onCancel: () => void;
  organizationSlug: string;
}) {
  const mutation = useMutation({
    mutationFn: (data: ApiKeyFormValues) =>
      fetchMutation<DeprecatedApiKey>({
        url: `/organizations/${organizationSlug}/api-keys/${apiKey.id}/`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      addSuccessMessage('Saved changes');
      onCancel();
    },
    onError: () => {
      addErrorMessage('Unable to save changes. Please try again.');
    },
  });
  const defaultValues: ApiKeyFormValues = {
    label: apiKey.label,
    key: apiKey.key,
    scope_list: apiKey.scope_list,
    allowed_origins: apiKey.allowed_origins,
  };
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: apiKeySchema},
    onSubmit: ({value}) => mutation.mutateAsync(value).catch(() => {}),
  });

  return (
    <form.AppForm form={form}>
      <Panel>
        <PanelHeader>{t('API Key')}</PanelHeader>
        <PanelBody>
          <Stack gap="lg">
            <form.AppField name="label">
              {field => (
                <field.Layout.Row label={t('Label')}>
                  <field.Input value={field.state.value} onChange={field.handleChange} />
                </field.Layout.Row>
              )}
            </form.AppField>
            <form.AppField name="key">
              {field => (
                <field.Layout.Row label={t('API Key')}>
                  <field.Input
                    value={field.state.value}
                    onChange={field.handleChange}
                    disabled
                  />
                </field.Layout.Row>
              )}
            </form.AppField>
            <form.AppField name="scope_list">
              {field => (
                <field.Layout.Stack label={t('Scopes')} required>
                  <MultipleCheckbox
                    value={field.state.value}
                    onChange={value => field.handleChange(scopeListSchema.parse(value))}
                    name={field.name}
                  >
                    {API_ACCESS_SCOPES.map(scope => (
                      <MultipleCheckbox.Item value={scope} key={scope}>
                        {scope}
                      </MultipleCheckbox.Item>
                    ))}
                  </MultipleCheckbox>
                </field.Layout.Stack>
              )}
            </form.AppField>
            <form.AppField name="allowed_origins">
              {field => (
                <field.Layout.Row
                  label={t('Allowed Domains')}
                  hintText={t('Separate multiple entries with a newline')}
                >
                  <field.TextArea
                    value={field.state.value}
                    onChange={field.handleChange}
                    placeholder={t('e.g. example.com or https://example.com')}
                  />
                </field.Layout.Row>
              )}
            </form.AppField>
            <Flex gap="sm" justify="end">
              <Button onClick={onCancel}>{t('Cancel')}</Button>
              <form.SubmitButton>{t('Save Changes')}</form.SubmitButton>
            </Flex>
          </Stack>
        </PanelBody>
      </Panel>
    </form.AppForm>
  );
}

export default OrganizationApiKeyDetails;
