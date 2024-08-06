import {useEffect} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApiQuery} from 'sentry/utils/queryClient';
import MessagingIntegrationModal from 'sentry/views/alerts/rules/issue/messagingIntegrationModal';

type Props = {
  organization: Organization;
  projectSlug: string;
  refetchConfigs: () => void;
};

function SetupMessagingIntegrationButton({
  organization,
  projectSlug,
  refetchConfigs,
}: Props) {
  const providerKeys = ['slack', 'discord', 'msteams'];

  const onAddIntegration = () => {
    refetch();
    refetchConfigs();
  };

  const {
    data: project,
    isLoading,
    isError,
    refetch,
  } = useApiQuery<{}>(
    [`/projects/${organization.slug}/${projectSlug}/?expand=hasAlertIntegration`],
    {staleTime: Infinity}
  );

  const detailedProject = project as Project & {
    hasAlertIntegrationInstalled: boolean;
  };

  useEffect(() => {
    if (detailedProject && !detailedProject.hasAlertIntegrationInstalled) {
      trackAnalytics('onboarding.messaging_integration_button_rendered', {
        project_id: detailedProject.id,
        organization,
      });
    }
  }, [detailedProject, organization]);

  if (isLoading || isError) {
    return null;
  }

  if (!detailedProject || detailedProject.hasAlertIntegrationInstalled) {
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
        onClick={() =>
          openModal(
            deps => (
              <MessagingIntegrationModal
                {...deps}
                headerContent={<h1>Connect with a messaging tool</h1>}
                bodyContent={<p>Receive alerts and digests right where you work.</p>}
                providerKeys={providerKeys}
                organization={organization}
                project={detailedProject}
                onAddIntegration={onAddIntegration}
              />
            ),
            {
              closeEvents: 'escape-key',
            }
          )
        }
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
