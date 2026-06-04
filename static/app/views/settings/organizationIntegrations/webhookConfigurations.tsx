import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {Button, LinkButton} from '@sentry/scraps/button';
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
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

import type {WebhookProject} from './webhookDetailedView';

interface WebhookConfigurationsProps {
  webhookProjects: WebhookProject[];
}

function useWebhookQueryKey() {
  const organization = useOrganization();
  return apiOptions.as<unknown>()(
    '/organizations/$organizationIdOrSlug/legacy-webhooks/',
    {
      path: {organizationIdOrSlug: organization.slug},
      staleTime: 0,
    }
  ).queryKey;
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
    <Fragment>
      {webhookProjects.map(project => (
        <WebhookProjectRow key={project.projectId} project={project} />
      ))}
    </Fragment>
  );
}

function WebhookProjectRow({project}: {project: WebhookProject}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {projects: allProjects} = useProjects();
  const queryKey = useWebhookQueryKey();

  const projectAccess = hasEveryAccess(['project:write'], {
    organization,
    project: allProjects.find(p => p.id === String(project.projectId)),
  });

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

  const confirmMessage = useMemo(
    () =>
      t(
        'Deleting this configuration will disable webhooks for this project and remove any configured URLs.'
      ),
    []
  );

  return (
    <RowContainer data-test-id="webhook-project-row">
      <RowContent>
        <ProjectBox>
          <ProjectBadge
            project={{
              slug: project.projectSlug,
              platform: project.projectPlatform || undefined,
            }}
          />
        </ProjectBox>
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
          <MutedButton
            disabled={!projectAccess}
            variant="transparent"
            icon={<IconDelete />}
            data-test-id="integration-remove-button"
          >
            {t('Uninstall')}
          </MutedButton>
        </Confirm>
        <Switch
          checked={project.enabled}
          onChange={() => toggleMutation.mutate(!project.enabled)}
          disabled={!projectAccess}
        />
      </RowContent>
    </RowContainer>
  );
}

const RowContainer = styled('div')`
  padding: ${p => p.theme.space.xl};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-bottom: none;
  background-color: ${p => p.theme.tokens.background.primary};

  &:last-child {
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

const RowContent = styled('div')`
  display: flex;
  align-items: center;
`;

const ProjectBox = styled('div')`
  flex: 1 0 fit-content;
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  min-width: 0;
`;

const MutedButton = styled(Button)`
  color: ${p => p.theme.tokens.content.secondary};
`;
