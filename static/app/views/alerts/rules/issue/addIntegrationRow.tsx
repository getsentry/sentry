import {useContext} from 'react';
import styled from '@emotion/styled';

import PluginIcon from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';
import IntegrationButton from 'sentry/views/settings/organizationIntegrations/integrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

type Props = {
  onClickHandler: () => void;
};

function AddIntegrationRow({onClickHandler}: Props) {
  const integration = useContext(IntegrationContext);
  if (!integration) {
    return null;
  }
  const provider = integration.provider;

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
      <StyledButton
        onAddIntegration={onClickHandler}
        onExternalClick={onClickHandler}
        externalInstallText="Add Installation"
        buttonProps={buttonProps}
      />
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
