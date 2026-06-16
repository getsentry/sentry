import {Fragment} from 'react';
import {mutationOptions, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {DrawerBody, DrawerHeader, useDrawer} from '@sentry/scraps/drawer';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {hasEveryAccess} from 'sentry/components/acl/access';
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

interface UseInstallationSettingsResult {
  /**
   * Opens a settings drawer for the integration, rendering each
   * `configOrganization` field as an auto-saving form. Fields are disabled
   * with a permission tooltip when `hasAccess` is false.
   */
  openSettings: () => void;
}

export function useInstallationSettings(
  integration: OrganizationIntegration | undefined
): UseInstallationSettingsResult {
  const organization = useOrganization();
  const hasAccess = hasEveryAccess(['org:integrations'], {organization});
  const queryClient = useQueryClient();

  const {openDrawer} = useDrawer();

  function openSettings() {
    if (!integration) {
      return;
    }

    const integrationQueryOptions = apiOptions.as<OrganizationIntegration>()(
      '/organizations/$organizationIdOrSlug/integrations/$integrationId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          integrationId: integration.id,
        },
        staleTime: 60_000,
      }
    );

    const integrationEndpoint = getApiUrl(
      '/organizations/$organizationIdOrSlug/integrations/$integrationId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          integrationId: integration.id,
        },
      }
    );
    const integrationMutationOptions = mutationOptions({
      mutationFn: (data: Record<string, unknown>) =>
        fetchMutation({method: 'POST', url: integrationEndpoint, data}),
      onSuccess: () =>
        queryClient.invalidateQueries({queryKey: integrationQueryOptions.queryKey}),
    });

    const fields = hasAccess
      ? (integration.configOrganization ?? [])
      : (integration.configOrganization?.map(f => ({
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
                      integration.configData?.[fieldConfig.name] as FieldValue<
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
  }

  return {openSettings};
}
