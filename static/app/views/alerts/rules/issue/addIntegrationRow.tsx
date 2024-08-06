import {useContext} from 'react';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import IntegrationButton from 'sentry/views/settings/organizationIntegrations/integrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

type Props = {
  onClick: () => void;
  organization: Organization;
};

function AddIntegrationRow({organization, onClick}: Props) {
  const integration = useContext(IntegrationContext);
  if (!integration) {
    return null;
  }
  const provider = integration.provider;
  const onAddIntegration = () => {
    integration.onAddIntegration?.();
    onClick();
  };

  const buttonProps = {
    size: 'sm',
    priority: 'primary',
    'data-test-id': 'install-button',
  };

  return (
    <RowWrapper>
      <IconTextWrapper>
        <PluginIcon pluginId={provider.slug} size={40} />
        <NameHeader>Connect {provider.name}</NameHeader>
      </IconTextWrapper>
      <Access access={['org:integrations']} organization={organization}>
        {({hasAccess}) => {
          return (
            <StyledButton
              organization={organization}
              userHasAccess={hasAccess}
              onAddIntegration={onAddIntegration}
              onExternalClick={onClick}
              externalInstallText="Add Installation"
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
  border: 1px solid ${p => p.theme.gray200};
  justify-content: space-between;
  align-items: center;
  padding: ${space(3)} ${space(4)};
`;

const IconTextWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(3)};
`;

const NameHeader = styled('h6')`
  margin: 0;
`;

const StyledButton = styled(IntegrationButton)`
  margin: 0;
`;

export default AddIntegrationRow;
