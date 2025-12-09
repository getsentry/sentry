import Access from 'sentry/components/acl/access';
import Placeholder from 'sentry/components/placeholder';
import {IconAdd, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import type {AddIntegrationButton} from 'sentry/views/settings/organizationIntegrations/addIntegrationButton';
import IntegrationButton from 'sentry/views/settings/organizationIntegrations/integrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

import {useSeerOnboardingContext} from './hooks/seerOnboardingContext';

interface GithubButtonProps {
  analyticsView: 'seer_onboarding_github' | 'seer_onboarding_code_review';
  onAddIntegration: () => void;
  buttonProps?: Pick<
    React.ComponentProps<typeof AddIntegrationButton>,
    'size' | 'priority' | 'disabled' | 'style' | 'data-test-id' | 'icon' | 'buttonText'
  >;
}

export function GithubButton({
  onAddIntegration,
  analyticsView,
  buttonProps,
}: GithubButtonProps) {
  const {provider, isProviderPending, installationData, isInstallationPending} =
    useSeerOnboardingContext();
  const organization = useOrganization();
  const hasInstallation = installationData?.find(
    installation => installation.provider.key === 'github'
  );

  if (!provider || isProviderPending || isInstallationPending) {
    return <Placeholder />;
  }

  return (
    <IntegrationContext
      value={{
        provider,
        type: 'first_party',
        installStatus: hasInstallation ? 'Installed' : 'Not Installed', // `AddIntegrationButton` only handles `Disabled`
        analyticsParams: {
          view: analyticsView,
          already_installed: Boolean(hasInstallation),
        },
      }}
    >
      <Access access={['org:integrations']} organization={organization}>
        {({hasAccess}) => (
          <IntegrationButton
            userHasAccess={hasAccess}
            onAddIntegration={onAddIntegration}
            onExternalClick={() => {}}
            buttonProps={
              buttonProps ?? {
                icon: hasInstallation ? <IconSettings /> : <IconAdd />,
                buttonText: hasInstallation
                  ? t('Manage GitHub Integration')
                  : t('Connect GitHub'),
                priority: 'primary',
              }
            }
          />
        )}
      </Access>
    </IntegrationContext>
  );
}
