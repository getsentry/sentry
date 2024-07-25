import Access from 'sentry/components/acl/access';
import {Button} from 'sentry/components/button';
import type {IntegrationProvider} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {AddIntegrationButton} from 'sentry/views/settings/organizationIntegrations/addIntegrationButton';
import RequestIntegrationButton from 'sentry/views/settings/organizationIntegrations/integrationRequest/RequestIntegrationButton';

type Props = {
  onAddIntegration: () => void;
  onExternalClick: () => void;
  organization: Organization;
  project: Project;
  provider: IntegrationProvider;
  buttonProps: buttonProps;
};

type buttonProps = {
  style?;
  size?;
  priority?;
  disabled?;
} | null;

function IntegrationButton({
  onAddIntegration,
  onExternalClick,
  organization,
  project,
  provider,
  buttonProps,
}: Props) {
  const {metadata} = provider;

  // const buttonProps = {
  //   size: 'sm' as const,
  //   priority: 'primary' as const,
  //   'data-test-id': 'install-button',
  //   // disabled: disabledFromFeatures,
  //   organization,
  // };
  return (
    <Access access={['org:integrations']} organization={organization}>
      {({hasAccess}) => {
        if (!hasAccess) {
          return (
            <RequestIntegrationButton
              organization={organization}
              name={provider.name}
              slug={provider.slug}
              type={'sentry_app'}
            />
          );
        }
        if (metadata.aspects.externalInstall) {
          return (
            <Button
              href={metadata.aspects.externalInstall.url}
              onClick={() => onExternalClick}
              external
              {...buttonProps}
            >
              Add Installation
            </Button>
          );
        }
        return (
          <AddIntegrationButton
            provider={provider}
            onAddIntegration={onAddIntegration}
            analyticsParams={{view: 'onboarding', already_installed: false}}
            modalParams={{projectId: project.id}}
            organization={organization}
            {...buttonProps}
          />
        );
      }}
    </Access>
  );
}

export default IntegrationButton;
