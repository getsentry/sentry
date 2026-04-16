import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex, Grid} from '@sentry/scraps/layout';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {BackendJsonSubmitForm} from 'sentry/components/backendJsonFormAdapter/backendJsonSubmitForm';
import type {JsonFormAdapterFieldConfig} from 'sentry/components/backendJsonFormAdapter/types';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelAlert} from 'sentry/components/panels/panelAlert';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import type {Plugin} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {isScmPlugin} from 'sentry/utils/integrationUtil';
import {fetchMutation, useApiQuery, useMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * Field config shape returned by the backend's PluginWithConfigSerializer.
 */
interface BackendPluginField {
  label: string;
  name: string;
  type: string;
  choices?: Array<[string, string]>;
  default?: unknown;
  defaultValue?: unknown;
  help?: null | string;
  placeholder?: null | string;
  readonly?: boolean;
  required?: boolean;
  value?: unknown;
}

interface PluginWithConfig extends Plugin {
  auth_url?: string;
  config?: BackendPluginField[];
  config_error?: string;
}

interface PluginTestResponse {
  detail?: string | unknown;
}

function getDetailMessage(response: PluginTestResponse): string {
  if (response.detail === null || response.detail === undefined) {
    return '';
  }
  if (typeof response.detail === 'string') {
    return response.detail;
  }
  return JSON.stringify(response.detail);
}

/**
 * Maps a backend plugin field to the JsonFormAdapterFieldConfig shape
 * expected by BackendJsonSubmitForm.
 */
function mapPluginField(field: BackendPluginField): JsonFormAdapterFieldConfig {
  const base = {
    name: field.name,
    label: field.label,
    required: field.required,
    help: field.help ?? undefined,
    placeholder: field.placeholder ?? undefined,
    disabled: field.readonly,
  };

  const defaultValue = field.defaultValue ?? field.default;

  // Backend uses 'bool', adapter uses 'boolean'
  const type = field.type === 'bool' ? 'boolean' : field.type;

  switch (type) {
    case 'boolean':
      return {
        ...base,
        type: 'boolean',
        default: typeof defaultValue === 'boolean' ? defaultValue : undefined,
      };
    case 'select':
    case 'choice': {
      const emptyChoiceLabel = field.choices?.find(([value]) => value === '')?.[1];
      const normalizedChoices = field.choices?.filter(([value]) => value !== '');

      // Legacy plugin configs often encode placeholder text as an empty option.
      // Preserve that UX by treating it as placeholder, not as a selectable value.
      const placeholder = base.placeholder ?? emptyChoiceLabel ?? undefined;
      const normalizedDefault = defaultValue === '' ? undefined : defaultValue;

      return {
        ...base,
        type,
        placeholder,
        default: normalizedDefault,
        choices: normalizedChoices,
      };
    }
    case 'secret':
      return {
        ...base,
        type: 'secret',
        default: defaultValue,
        placeholder: field.placeholder ?? t('Enter a secret'),
      };
    case 'textarea':
      return {...base, type: 'textarea', default: defaultValue};
    case 'number':
      return {
        ...base,
        type: 'number',
        default: typeof defaultValue === 'number' ? defaultValue : undefined,
      };
    case 'email':
      return {...base, type: 'email', default: defaultValue};
    case 'url':
      return {...base, type: 'url', default: defaultValue};
    case 'string':
    case 'text':
    default:
      return {...base, type: 'text', default: defaultValue};
  }
}

interface PluginConfigProps {
  plugin: Plugin;
  project: Project;
  enabled?: boolean;
  onDisablePlugin?: (data: Plugin) => void;
}

export function PluginConfig({
  plugin,
  project,
  enabled,
  onDisablePlugin,
}: PluginConfigProps) {
  const organization = useOrganization();
  const isEnabled = enabled ?? plugin.enabled;
  const hasWriteAccess = hasEveryAccess(['project:write'], {organization, project});

  const pluginEndpoint = getApiUrl(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/plugins/$pluginId/',
    {
      path: {
        organizationIdOrSlug: organization.slug,
        projectIdOrSlug: project.slug,
        pluginId: plugin.id,
      },
    }
  );

  const {
    data: pluginData,
    isPending,
    isError,
    refetch,
  } = useApiQuery<PluginWithConfig>([pluginEndpoint], {
    staleTime: 0,
  });

  const config = pluginData?.config ?? [];
  const wasConfigured = config.some(
    field => field.value !== null && field.value !== undefined && field.value !== ''
  );

  const fields = config.map(mapPluginField);
  const formKey = config
    .map(
      field =>
        `${field.name}:${JSON.stringify(field.value)}:${JSON.stringify(field.defaultValue)}`
    )
    .join(',');
  const initialValues: Record<string, unknown> = {};
  for (const field of config) {
    if (field.value === undefined) {
      continue;
    }

    const type = field.type === 'bool' ? 'boolean' : field.type;
    const isSelect = type === 'select' || type === 'choice';

    if (field.value === null && !isSelect) {
      continue;
    }

    initialValues[field.name] = isSelect && field.value === '' ? null : field.value;
  }

  const testMutation = useMutation({
    mutationFn: () => {
      addLoadingMessage(t('Sending test...'));
      return fetchMutation<PluginTestResponse>({
        method: 'POST',
        url: pluginEndpoint,
        data: {test: true},
      });
    },
    onSuccess: () => addSuccessMessage(t('Test Complete!')),
    onError: () =>
      addErrorMessage(
        t('An unexpected error occurred while testing your plugin. Please try again.')
      ),
  });

  const submitMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => {
      if (!wasConfigured) {
        trackAnalytics('integrations.installation_start', {
          integration: plugin.id,
          integration_type: 'plugin',
          is_scm: isScmPlugin(plugin),
          view: 'plugin_details',
          already_installed: false,
          organization,
        });
      }
      addLoadingMessage(t('Saving changes\u2026'));
      return fetchMutation({
        method: 'PUT',
        url: pluginEndpoint,
        data: values,
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Success!'));
      trackAnalytics('integrations.config_saved', {
        integration: plugin.id,
        integration_type: 'plugin',
        view: 'plugin_details',
        already_installed: wasConfigured,
        organization,
      });
      if (!wasConfigured) {
        trackAnalytics('integrations.installation_complete', {
          integration: plugin.id,
          integration_type: 'plugin',
          is_scm: isScmPlugin(plugin),
          view: 'plugin_details',
          already_installed: false,
          organization,
        });
      }
      refetch();
    },
    onError: () => addErrorMessage(t('Unable to save changes. Please try again.')),
  });

  // Auth error state (e.g. OAuth plugins needing identity association)
  if (pluginData?.config_error) {
    let authUrl = pluginData.auth_url ?? '';
    if (authUrl.includes('?')) {
      authUrl += '&next=' + encodeURIComponent(document.location.pathname);
    } else {
      authUrl += '?next=' + encodeURIComponent(document.location.pathname);
    }
    return (
      <Panel>
        <PanelHeader hasButtons>
          <Flex align="center" flex="1">
            <StyledPluginIcon pluginId={plugin.id} />
            <span>{plugin.name}</span>
          </Flex>
        </PanelHeader>
        <StyledPanelBody>
          <div dangerouslySetInnerHTML={{__html: plugin.doc}} />
          <Alert.Container>
            <Alert variant="warning" showIcon={false}>
              {pluginData.config_error}
            </Alert>
          </Alert.Container>
          <LinkButton priority="primary" href={authUrl}>
            {t('Associate Identity')}
          </LinkButton>
        </StyledPanelBody>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader hasButtons>
        <Flex align="center" flex="1">
          <StyledPluginIcon pluginId={plugin.id} />
          <span>{plugin.name}</span>
        </Flex>

        {plugin.canDisable && isEnabled && (
          <Grid flow="column" align="center" gap="md">
            {plugin.isTestable && (
              <Button onClick={() => testMutation.mutate()} size="xs">
                {t('Test Plugin')}
              </Button>
            )}
            <Button
              size="xs"
              onClick={() => onDisablePlugin?.(plugin)}
              disabled={!hasWriteAccess}
            >
              {t('Disable')}
            </Button>
          </Grid>
        )}
      </PanelHeader>

      {plugin.status === 'beta' && (
        <PanelAlert variant="warning">
          {t('This plugin is considered beta and may change in the future.')}
        </PanelAlert>
      )}

      {testMutation.data && (
        <PanelAlert variant="info">
          <strong>Test Results</strong>
          <div>{getDetailMessage(testMutation.data)}</div>
        </PanelAlert>
      )}

      <StyledPanelBody>
        <div dangerouslySetInnerHTML={{__html: plugin.doc}} />
        {isPending ? (
          <LoadingIndicator />
        ) : isError ? (
          <LoadingError onRetry={refetch} />
        ) : fields.length > 0 ? (
          <BackendJsonSubmitForm
            key={formKey}
            fields={fields}
            initialValues={initialValues}
            onSubmit={values => submitMutation.mutate(values)}
            submitLabel={t('Save Changes')}
            submitDisabled={!hasWriteAccess}
            footer={({SubmitButton, disabled}) => (
              <Flex
                justify="end"
                borderTop="primary"
                paddingTop="lg"
                paddingBottom="xl"
                marginTop="xl"
              >
                <SubmitButton size="sm" disabled={disabled}>
                  {t('Save Changes')}
                </SubmitButton>
              </Flex>
            )}
          />
        ) : null}
      </StyledPanelBody>
    </Panel>
  );
}

const StyledPluginIcon = styled(PluginIcon)`
  margin-right: ${p => p.theme.space.md};
`;

const StyledPanelBody = styled(PanelBody)`
  padding: ${p => p.theme.space.xl};
  padding-bottom: 0;
`;
