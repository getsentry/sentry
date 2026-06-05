import {useMemo} from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Confirm} from 'sentry/components/confirm';
import {EmptyMessage} from 'sentry/components/emptyMessage';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Panel} from 'sentry/components/panels/panel';
import {IconDelete, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

import {legacyWebhooksQueryOptions} from './webhookDetailedView';
import type {WebhookProject} from './webhookDetailedView';

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
      addLoadingMessage(shouldEnable ? t('Enabling...') : t('Disabling...'));
      return fetchMutation({
        method: 'POST',
        url: `/projects/${organization.slug}/${project.projectSlug}/legacy-webhooks/`,
        data: {enabled: shouldEnable},
      });
    },
    onSuccess: (_data, shouldEnable) => {
      addSuccessMessage(
        shouldEnable ? t('Configuration was enabled.') : t('Configuration was disabled.')
      );
      queryClient.invalidateQueries({queryKey});
    },
    onError: (_error, shouldEnable) => {
      addErrorMessage(
        shouldEnable
          ? t('Unable to enable configuration.')
          : t('Unable to disable configuration.')
      );
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: () => {
      addLoadingMessage(t('Removing...'));
      return fetchMutation({
        method: 'DELETE',
        url: `/projects/${organization.slug}/${project.projectSlug}/legacy-webhooks/`,
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Configuration was removed'));
      queryClient.invalidateQueries({queryKey});
    },
    onError: () => {
      addErrorMessage(t('Unable to remove configuration'));
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
          to={`/settings/${organization.slug}/projects/${project.projectSlug}/plugins/webhooks/`}
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
