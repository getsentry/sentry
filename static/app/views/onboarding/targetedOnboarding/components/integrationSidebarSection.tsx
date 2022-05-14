import {Fragment} from 'react';
import styled from '@emotion/styled';

import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import space from 'sentry/styles/space';
import {IntegrationProvider} from 'sentry/types';

type Props = {
  activeIntegration: string | null;
  installedIntegrations: Set<string>;
  providers: IntegrationProvider[];
  selectActiveIntegration: (slug: string) => void;
  selectedIntegrations: string[];
};
function IntegrationSidebarSection({
  activeIntegration,
  installedIntegrations,
  selectedIntegrations,
  selectActiveIntegration,
  providers,
}: Props) {
  const oneIntegration = (integration: string) => {
    const isActive = activeIntegration === integration;
    const isInstalled = installedIntegrations.has(integration);
    const provider = providers.find(p => p.slug === integration);
    // should never happen
    if (!provider) {
      return null;
    }
    return (
      <IntegrationWrapper
        key={integration}
        isActive={isActive}
        onClick={() => selectActiveIntegration(integration)}
      >
        <PluginIcon pluginId={integration} size={36} />
        <MiddleWrapper>
          <NameWrapper>{provider.name}</NameWrapper>
          <SubHeader
            isInstalled={isInstalled}
            data-test-id="sidebar-integration-indicator"
          >
            {isInstalled ? t('Installed') : t('Not Installed')}
          </SubHeader>
        </MiddleWrapper>
        {isInstalled ? <StyledIconCheckmark isCircled color="green400" /> : null}
      </IntegrationWrapper>
    );
  };
  return (
    <Fragment>
      <Title>{t('Integrations to Setup')}</Title>
      {selectedIntegrations.map(oneIntegration)}
    </Fragment>
  );
}

export default IntegrationSidebarSection;

const Title = styled('span')`
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  margin-left: ${space(2)};
`;

const SubHeader = styled('div')<{isInstalled: boolean}>`
  color: ${p => (p.isInstalled ? p.theme.successText : p.theme.textColor)};
`;

const IntegrationWrapper = styled('div')<{isActive: boolean}>`
  display: flex;
  flex-direction: row;
  align-items: center;
  background-color: ${p => p.isActive && p.theme.gray100};
  padding: ${space(2)};
  cursor: pointer;
  border-radius: 4px;
  user-select: none;
`;

const StyledIconCheckmark = styled(IconCheckmark)`
  flex-shrink: 0;
`;

const MiddleWrapper = styled('div')`
  margin: 0 ${space(1)};
  flex-grow: 1;
  overflow: hidden;
`;

const NameWrapper = styled('div')`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;
