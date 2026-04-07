import {useMemo, useRef, useState} from 'react';
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
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {fetchMutation, useApiQuery} from 'sentry/utils/queryClient';
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
  hasSavedValue?: boolean;
  help?: string;
  isDeprecated?: boolean;
  isHidden?: boolean;
  placeholder?: string;
  prefix?: string;
  readonly?: boolean;
  required?: boolean;
  value?: unknown;
}

interface PluginWithConfig extends Plugin {
  auth_url?: string;
  config?: BackendPluginField[];
  config_error?: string;
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
    default: field.defaultValue ?? field.default,
  };

  // Backend uses 'bool', adapter uses 'boolean'
  const type = field.type === 'bool' ? 'boolean' : field.type;

  switch (type) {
    case 'boolean':
      return {...base, type: 'boolean'} as JsonFormAdapterFieldConfig;
    case 'select':
    case 'choice':
      return {
        ...base,
        type: type as 'select' | 'choice',
        choices: field.choices,
      } as JsonFormAdapterFieldConfig;
    case 'secret':
      return {...base, type: 'secret'} as JsonFormAdapterFieldConfig;
    case 'textarea':
      return {...base, type: 'textarea'} as JsonFormAdapterFieldConfig;
    case 'number':
      return {...base, type: 'number'} as JsonFormAdapterFieldConfig;
    case 'email':
      return {...base, type: 'email'} as JsonFormAdapterFieldConfig;
    case 'url':
      return {...base, type: 'url'} as JsonFormAdapterFieldConfig;
    case 'string':
    case 'text':
    default:
      return {...base, type: 'text'} as JsonFormAdapterFieldConfig;
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
  const isEnabled = typeof enabled === 'undefined' ? plugin.enabled : enabled;
  const hasWriteAccess = hasEveryAccess(['project:write'], {organization, project});
  const [testResults, setTestResults] = useState('');

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

  const wasConfiguredRef = useRef(false);

  const {fields, initialValues} = useMemo(() => {
    if (!pluginData?.config) {
      return {fields: [], initialValues: {}};
    }

    let configured = false;
    const vals: Record<string, unknown> = {};
    const mapped: JsonFormAdapterFieldConfig[] = [];

    for (const field of pluginData.config) {
      if (field.value) {
        configured = true;
      }
      vals[field.name] = field.value ?? field.defaultValue ?? '';
      mapped.push(mapPluginField(field));
    }

    wasConfiguredRef.current = configured;
    return {fields: mapped, initialValues: vals};
  }, [pluginData]);

  const handleTestPlugin = async () => {
    setTestResults('');
    addLoadingMessage(t('Sending test...'));

    try {
      const response = (await fetchMutation({
        method: 'POST',
        url: pluginEndpoint,
        data: {test: true},
      })) as {detail: string};

      setTestResults(JSON.stringify(response.detail));
      addSuccessMessage(t('Test Complete!'));
    } catch (_err) {
      addErrorMessage(
        t('An unexpected error occurred while testing your plugin. Please try again.')
      );
    }
  };

  const handleDisablePlugin = () => {
    onDisablePlugin?.(plugin);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!wasConfiguredRef.current) {
      trackIntegrationAnalytics('integrations.installation_start', {
        integration: plugin.id,
        integration_type: 'plugin',
        view: 'plugin_details',
        already_installed: false,
        organization,
      });
    }

    addLoadingMessage(t('Saving changes\u2026'));

    try {
      await fetchMutation({
        method: 'PUT',
        url: pluginEndpoint,
        data: values,
      });

      addSuccessMessage(t('Success!'));

      trackIntegrationAnalytics('integrations.config_saved', {
        integration: plugin.id,
        integration_type: 'plugin',
        view: 'plugin_details',
        already_installed: wasConfiguredRef.current,
        organization,
      });

      if (!wasConfiguredRef.current) {
        trackIntegrationAnalytics('integrations.installation_complete', {
          integration: plugin.id,
          integration_type: 'plugin',
          view: 'plugin_details',
          already_installed: false,
          organization,
        });
      }

      refetch();
    } catch (_err) {
      addErrorMessage(t('Unable to save changes. Please try again.'));
    }
  };

  // Auth error state (e.g. OAuth plugins needing identity association)
  if (pluginData?.config_error) {
    let authUrl = pluginData.auth_url ?? '';
    if (authUrl.includes('?')) {
      authUrl += '&next=' + encodeURIComponent(document.location.pathname);
    } else {
      authUrl += '?next=' + encodeURIComponent(document.location.pathname);
    }
    return (
      <Panel
        className={`plugin-config ref-plugin-config-${plugin.id}`}
        data-test-id="plugin-config"
      >
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
    <Panel
      className={`plugin-config ref-plugin-config-${plugin.id}`}
      data-test-id="plugin-config"
    >
      <PanelHeader hasButtons>
        <Flex align="center" flex="1">
          <StyledPluginIcon pluginId={plugin.id} />
          <span>{plugin.name}</span>
        </Flex>

        {plugin.canDisable && isEnabled && (
          <Grid flow="column" align="center" gap="md">
            {plugin.isTestable && (
              <Button onClick={handleTestPlugin} size="xs">
                {t('Test Plugin')}
              </Button>
            )}
            <Button size="xs" onClick={handleDisablePlugin} disabled={!hasWriteAccess}>
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

      {testResults !== '' && (
        <PanelAlert variant="info">
          <strong>Test Results</strong>
          <div>{testResults}</div>
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
            fields={fields}
            initialValues={initialValues}
            onSubmit={handleSubmit}
            submitLabel={t('Save Changes')}
            submitDisabled={!hasWriteAccess}
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
