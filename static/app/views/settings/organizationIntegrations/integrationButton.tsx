import {Project} from 'sentry/types/project';
import {Organization} from 'sentry/types/organization';
import {IntegrationProvider} from 'sentry/types/integrations';
import {AddIntegrationButton} from 'sentry/views/settings/organizationIntegrations/addIntegrationButton';
import {Button} from 'sentry/components/button';
import RequestIntegrationButton from 'sentry/views/settings/organizationIntegrations/integrationRequest/RequestIntegrationButton';
import Access from 'sentry/components/acl/access';

type Props = {
  onAddIntegration: () => void;
  onExternalClick: () => void;
  organization: Organization;
  project: Project;
  provider: IntegrationProvider;
};

function IntegrationButton({
  onAddIntegration,
  onExternalClick,
  organization,
  project,
  provider,
}: Props) {
  const {metadata} = provider;

  const buttonProps = {
    size: 'sm' as const,
    priority: 'primary' as const,
    'data-test-id': 'install-button',
    // disabled: disabledFromFeatures,
    organization,
  };
  return (
    <Access access={['org:integrations']}>
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
            {...buttonProps}
          />
        );
      }}
    </Access>
  );
}

export default IntegrationButton;
