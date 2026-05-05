import {Fragment} from 'react';
import {mutationOptions, useQueries, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {DrawerBody, DrawerHeader, useDrawer} from '@sentry/scraps/drawer';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {BackendJsonAutoSaveForm} from 'sentry/components/backendJsonFormAdapter/backendJsonAutoSaveForm';
import type {FieldValue} from 'sentry/components/backendJsonFormAdapter/types';
import {t} from 'sentry/locale';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

const NO_ACCESS_REASON = t(
  'You must be an organization owner, manager, or admin to change these settings.'
);

interface UseInstallationSettingsOptions {
  hasAccess: boolean;
  scmIntegrations: OrganizationIntegration[];
}

interface UseInstallationSettingsResult {
  /**
   * Full integration config keyed by integration ID, populated once each
   * per-integration config query resolves. Values are `undefined` while
   * their query is still in-flight.
   */
  configByIntegrationId: Record<string, OrganizationIntegration | undefined>;
  /**
   * Opens a settings drawer for the given integration, rendering each
   * `configOrganization` field as an auto-saving form. Fields are disabled
   * with a permission tooltip when `hasAccess` is false.
   */
  openInstallationSettings: (integration: OrganizationIntegration) => void;
}

export function useInstallationSettings({
  scmIntegrations,
  hasAccess,
}: UseInstallationSettingsOptions): UseInstallationSettingsResult {
  const organization = useOrganization();
  const {openDrawer} = useDrawer();
  const queryClient = useQueryClient();

  const configByIntegrationId = useQueries({
    queries: scmIntegrations.map(integration =>
      apiOptions.as<OrganizationIntegration>()(
        '/organizations/$organizationIdOrSlug/integrations/$integrationId/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            integrationId: integration.id,
          },
          staleTime: 60_000,
        }
      )
    ),
    combine: results =>
      Object.fromEntries(
        scmIntegrations.map((integration, i) => [integration.id, results[i]?.data])
      ),
  });

  const openInstallationSettings = (integration: OrganizationIntegration) => {
    const integrationOptions = apiOptions.as<OrganizationIntegration>()(
      '/organizations/$organizationIdOrSlug/integrations/$integrationId/',
      {
        path: {organizationIdOrSlug: organization.slug, integrationId: integration.id},
        staleTime: 60_000,
      }
    );
    const integrationEndpoint = getApiUrl(
      '/organizations/$organizationIdOrSlug/integrations/$integrationId/',
      {path: {organizationIdOrSlug: organization.slug, integrationId: integration.id}}
    );
    const integrationMutationOptions = mutationOptions({
      mutationFn: (data: Record<string, unknown>) =>
        fetchMutation({method: 'POST', url: integrationEndpoint, data}),
      onSuccess: () =>
        queryClient.invalidateQueries({queryKey: integrationOptions.queryKey}),
    });

    const resolvedIntegration = configByIntegrationId[integration.id] ?? integration;
    const fields = hasAccess
      ? (resolvedIntegration.configOrganization ?? [])
      : (resolvedIntegration.configOrganization?.map(f => ({
          ...f,
          disabled: true,
          disabledReason: NO_ACCESS_REASON,
        })) ?? []);

    openDrawer(
      () => (
        <Fragment>
          <DrawerHeader>
            <Flex align="center" gap="sm">
              {getIntegrationIcon(integration.provider.key, 'sm')}
              {t('%s Settings', integration.name)}
            </Flex>
          </DrawerHeader>
          <DrawerBody>
            {!hasAccess && (
              <Alert.Container>
                <Alert variant="warning">{NO_ACCESS_REASON}</Alert>
              </Alert.Container>
            )}
            <Stack gap="0">
              {fields.map((fieldConfig, index) => (
                <Container
                  key={fieldConfig.name}
                  padding="xl 0"
                  borderBottom={index < fields.length - 1 ? 'secondary' : undefined}
                >
                  <BackendJsonAutoSaveForm
                    field={fieldConfig}
                    initialValue={
                      resolvedIntegration.configData?.[fieldConfig.name] as FieldValue<
                        typeof fieldConfig
                      >
                    }
                    mutationOptions={integrationMutationOptions}
                  />
                </Container>
              ))}
            </Stack>
          </DrawerBody>
        </Fragment>
      ),
      {
        ariaLabel: t('Integration settings for %s', integration.name),
        drawerKey: `integration-settings-${integration.id}`,
      }
    );
  };

  return {configByIntegrationId, openInstallationSettings};
}
