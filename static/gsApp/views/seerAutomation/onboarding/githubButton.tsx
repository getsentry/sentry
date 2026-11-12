import {IconAdd} from '@sentry/icons/add';
import {IconSettings} from '@sentry/icons/settings';

import {Access} from 'sentry/components/acl/access';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {IntegrationButton} from 'sentry/views/settings/organizationIntegrations/integrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

import {useIntegrationInstallation} from './hooks/useIntegrationInstallation';
import {useIntegrationProvider} from './hooks/useIntegrationProvider';

interface GithubButtonProps {
  onAddIntegration: () => void;
}

export function GithubButton({onAddIntegration}: GithubButtonProps) {
  const {data: installationData, isPending: isInstallationPending} =
    useIntegrationInstallation('github');
  const {provider, isPending: isProviderPending} = useIntegrationProvider('github');
  const organization = useOrganization();
  const githubInstallation = installationData?.find(
    installation =>
      installation.provider.key === 'github' &&
      installation.organizationIntegrationStatus === 'active' &&
      installation.status === 'active'
  );

  if (!provider || isProviderPending || isInstallationPending) {
    return <Placeholder />;
  }

  return (
    <IntegrationContext
      value={{
        provider,
        type: 'first_party',
        installStatus: githubInstallation ? 'Installed' : 'Not Installed', // `AddIntegrationButton` only handles `Disabled`
        analyticsParams: {
          view: 'seer_onboarding_github',
          already_installed: Boolean(githubInstallation),
        },
      }}
    >
      <Access access={['org:integrations']} organization={organization}>
        {({hasAccess}) => (
          <IntegrationButton
            userHasAccess={hasAccess}
            onAddIntegration={onAddIntegration}
            onExternalClick={() => {}}
            buttonProps={{
              icon: githubInstallation ? <IconSettings /> : <IconAdd />,
              buttonText: githubInstallation
                ? t('Manage GitHub Integration')
                : t('Connect GitHub'),
              variant: 'primary',
            }}
          />
        )}
      </Access>
    </IntegrationContext>
  );
}
