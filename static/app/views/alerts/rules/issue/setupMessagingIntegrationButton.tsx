import {useEffect} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import MessagingIntegrationModal from 'sentry/views/alerts/rules/issue/messagingIntegrationModal';

interface ProjectWithAlertIntegrationInfo extends Project {
  hasAlertIntegrationInstalled: boolean;
}

type Props = {
  projectSlug: string;
  refetchConfigs: () => void;
};

function SetupMessagingIntegrationButton({projectSlug, refetchConfigs}: Props) {
  const providerKeys = ['slack', 'discord', 'msteams'];
  const organization = useOrganization();

  const onAddIntegration = () => {
    refetch();
    refetchConfigs();
  };

  const {
    data: project,
    isLoading,
    isError,
    refetch,
  } = useApiQuery<ProjectWithAlertIntegrationInfo>(
    [
      `/projects/${organization.slug}/${projectSlug}/`,
      {query: {expand: 'hasAlertIntegration'}},
    ],
    {staleTime: Infinity}
  );

  useEffect(() => {
    if (project && !project.hasAlertIntegrationInstalled) {
      trackAnalytics('onboarding.messaging_integration_button_rendered', {
        project_id: project.id,
        organization,
      });
    }
  }, [project, organization]);

  if (isLoading || isError) {
    return null;
  }

  if (!project || project.hasAlertIntegrationInstalled) {
    return null;
  }

  // TODO(Mia): only render if organization has team plan and above
  return (
    <Tooltip
      title={t('Send alerts to your messaging service. Install the integration now.')}
    >
      <Button
        size="sm"
        icon={
          <IconWrapper>
            {providerKeys.map((value: string) => {
              return <PluginIcon key={value} pluginId={value} size={16} />;
            })}
          </IconWrapper>
        }
        onClick={() => {
          openModal(
            deps => (
              <MessagingIntegrationModal
                {...deps}
                headerContent={t('Connect with a messaging tool')}
                bodyContent={t('Receive alerts and digests right where you work.')}
                providerKeys={providerKeys}
                organization={organization}
                project={project}
                onAddIntegration={onAddIntegration}
              />
            ),
            {
              closeEvents: 'escape-key',
            }
          );
          trackAnalytics('onboarding.messaging_integration_modal_rendered', {
            project_id: project.id,
            organization,
          });
        }}
      >
        {t('Connect to messaging')}
      </Button>
    </Tooltip>
  );
}

const IconWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

export default SetupMessagingIntegrationButton;
