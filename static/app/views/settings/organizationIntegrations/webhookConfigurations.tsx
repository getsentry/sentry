import {useMemo} from 'react';
import {IconDelete} from '@sentry/icons/delete';
import {IconSettings} from '@sentry/icons/settings';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Confirm} from '@sentry/scraps/confirm';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {toast} from '@sentry/scraps/toast';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {EmptyMessage} from 'sentry/components/emptyMessage';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Panel} from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

import {legacyWebhooksQueryOptions} from './legacyWebhooksQueryOptions';
import type {WebhookProject} from './legacyWebhooksQueryOptions';

interface WebhookConfigurationsProps {
  webhookProjects: WebhookProject[];
}

export function WebhookConfigurations({webhookProjects}: WebhookConfigurationsProps) {
  if (!webhookProjects.length) {
    return (
      <Panel>
        <EmptyMessage title={t('No projects have webhooks configured')} />
      </Panel>
    );
  }

  return (
    <Stack gap="sm">
      {webhookProjects.map(project => (
        <WebhookProjectRow key={project.projectId} project={project} />
      ))}
    </Stack>
  );
}

function useWebhookProjectMutations(project: WebhookProject) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const queryKey = legacyWebhooksQueryOptions(organization).queryKey;

  const toggleMutation = useMutation({
    mutationFn: (shouldEnable: boolean) => {
      toast.loading(shouldEnable ? t('Enabling...') : t('Disabling...'));
      return fetchMutation({
        method: 'POST',
        url: getApiUrl(
          '/projects/$organizationIdOrSlug/$projectIdOrSlug/legacy-webhooks/',
          {
            path: {
              organizationIdOrSlug: organization.slug,
              projectIdOrSlug: project.projectSlug,
            },
          }
        ),
        data: {enabled: shouldEnable},
      });
    },
    onSuccess: (_data, shouldEnable) => {
      toast.success(
        shouldEnable ? t('Configuration was enabled.') : t('Configuration was disabled.')
      );
      queryClient.invalidateQueries({queryKey});
    },
    onError: (_error, shouldEnable) => {
      toast.error(
        shouldEnable
          ? t('Unable to enable configuration.')
          : t('Unable to disable configuration.')
      );
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: () => {
      toast.loading(t('Removing...'));
      return fetchMutation({
        method: 'DELETE',
        url: getApiUrl(
          '/projects/$organizationIdOrSlug/$projectIdOrSlug/legacy-webhooks/',
          {
            path: {
              organizationIdOrSlug: organization.slug,
              projectIdOrSlug: project.projectSlug,
            },
          }
        ),
      });
    },
    onSuccess: () => {
      toast.success(t('Configuration was removed'));
      queryClient.invalidateQueries({queryKey});
    },
    onError: () => {
      toast.error(t('Unable to remove configuration'));
    },
  });

  return {toggleMutation, uninstallMutation};
}

function WebhookProjectRow({project}: {project: WebhookProject}) {
  const organization = useOrganization();
  const {projects: allProjects} = useProjects();
  const {toggleMutation, uninstallMutation} = useWebhookProjectMutations(project);

  const projectAccess = hasEveryAccess(['project:write'], {
    organization,
    project: allProjects.find(p => p.id === String(project.projectId)),
  });

  const confirmMessage = useMemo(
    () =>
      t(
        'Deleting this configuration will disable webhooks for this project and remove any configured URLs.'
      ),
    []
  );

  return (
    <Container
      padding="xl"
      border="primary"
      radius="md"
      background="primary"
      data-test-id="webhook-project-row"
    >
      <Flex align="center">
        <Flex flex="1 0 fit-content">
          <ProjectBadge
            project={{
              slug: project.projectSlug,
              platform: project.projectPlatform || undefined,
            }}
          />
        </Flex>
        <LinkButton
          variant="transparent"
          icon={<IconSettings />}
          to={`/settings/${organization.slug}/projects/${project.projectSlug}/legacy-webhooks/`}
          data-test-id="integration-configure-button"
        >
          {projectAccess ? t('Configure') : t('View')}
        </LinkButton>
        <Confirm
          priority="danger"
          disabled={!projectAccess}
          confirmText={t('Delete Installation')}
          onConfirm={() => uninstallMutation.mutate()}
          message={confirmMessage}
        >
          <Button
            disabled={!projectAccess}
            variant="transparent"
            icon={<IconDelete />}
            data-test-id="integration-remove-button"
          >
            {t('Uninstall')}
          </Button>
        </Confirm>
        <Switch
          checked={project.enabled}
          onChange={() => toggleMutation.mutate(!project.enabled)}
          disabled={!projectAccess}
        />
      </Flex>
    </Container>
  );
}
