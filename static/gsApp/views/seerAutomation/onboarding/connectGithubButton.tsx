import Access from 'sentry/components/acl/access';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import Placeholder from 'sentry/components/placeholder';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import IntegrationButton from 'sentry/views/settings/organizationIntegrations/integrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';
import type {IntegrationInformation} from 'sentry/views/settings/organizationIntegrations/integrationDetailedView';

interface Props {
  onAddIntegration: (integration: Integration) => void;
}

export function ConnectGithubButton({onAddIntegration}: Props) {
  const organization = useOrganization();
  const {data: integrationInfo, isPending: isIntegrationPending} =
    useApiQuery<IntegrationInformation>(
      [
        `/organizations/${organization.slug}/config/integrations/`,
        {
          query: {
            provider_key: 'github',
          },
        },
      ],
      {
        staleTime: Infinity,
        retry: false,
      }
    );

  const provider = integrationInfo?.providers[0];

  if (isIntegrationPending) {
    return <Placeholder />;
  }

  if (provider) {
    return (
      <IntegrationContext
        value={{
          provider,
          type: 'first_party',
          installStatus: 'Not Installed', // `AddIntegrationButton` only handles `Disabled`
          analyticsParams: {
            view: 'seer_onboarding_github',
            already_installed: false,
          },
        }}
      >
        <Flex gap="xl">
          <Access access={['org:integrations']} organization={organization}>
            {({hasAccess}) => (
              <IntegrationButton
                userHasAccess={hasAccess}
                onAddIntegration={onAddIntegration}
                onExternalClick={() => {}}
                buttonProps={{
                  icon: <IconAdd />,
                  buttonText: t('Connect GitHub'),
                  priority: 'primary',
                }}
              />
            )}
          </Access>
          <LinkButton priority="default" href="/settings/integrations/github">
            {t('Learn more')}
          </LinkButton>
        </Flex>
      </IntegrationContext>
    );
  }

  return (
    <Flex gap="xl">
      <LinkButton external priority="primary" href="https://github.com/apps/sentry">
        {t('Add installation')}
      </LinkButton>
      <LinkButton priority="default" href="/settings/integrations/github">
        {t('Learn more')}
      </LinkButton>
    </Flex>
  );
}
