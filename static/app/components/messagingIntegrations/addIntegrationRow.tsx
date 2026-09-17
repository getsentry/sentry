import {useContext} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {Access} from 'sentry/components/acl/access';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {useOrganization} from 'sentry/utils/useOrganization';
import {IntegrationButton} from 'sentry/views/settings/organizationIntegrations/integrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

type Props = {
  onClick: () => void;
};

export function AddIntegrationRow({onClick}: Props) {
  const organization = useOrganization();
  const {isSelfHosted} = ConfigStore.getState();
  const integration = useContext(IntegrationContext);
  if (!integration) {
    return null;
  }
  const provider = integration.provider;
  const onAddIntegration = () => {
    integration.onAddIntegration?.();
    onClick();
  };

  const buttonText = t('Add %s', provider.name);
  const buttonProps = {
    size: 'sm',
    priority: 'primary',
    'data-test-id': 'install-button',
    buttonText,
  } as const;

  return (
    <RowWrapper>
      <Flex align="center" gap="2xl">
        <PluginIcon pluginId={provider.slug} size={40} />
        <NameHeader>Connect {provider.name}</NameHeader>
      </Flex>
      <Access access={['org:integrations']} organization={organization}>
        {({hasAccess}) => {
          return isSelfHosted ? (
            <LinkButton
              href={`https://develop.sentry.dev/integrations/${provider.slug}`}
              variant="primary"
              external
            >
              {buttonText}
            </LinkButton>
          ) : (
            <StyledButton
              userHasAccess={hasAccess}
              onAddIntegration={onAddIntegration}
              onExternalClick={onClick}
              externalInstallText={buttonText}
              buttonProps={buttonProps}
            />
          );
        }}
      </Access>
    </RowWrapper>
  );
}

const RowWrapper = styled('div')`
  display: flex;
  border-radius: 4px;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  justify-content: space-between;
  align-items: center;
  padding: ${p => p.theme.space['2xl']} ${p => p.theme.space['3xl']};
`;

const NameHeader = styled('h6')`
  margin: 0;
`;

const StyledButton = styled(IntegrationButton)`
  margin: 0;
`;
