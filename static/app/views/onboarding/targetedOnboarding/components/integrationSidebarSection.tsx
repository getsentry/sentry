import {Fragment} from 'react';
import styled from '@emotion/styled';
import {motion, Variants} from 'framer-motion';

import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import space from 'sentry/styles/space';
import {IntegrationProvider} from 'sentry/types';
import testableTransition from 'sentry/utils/testableTransition';

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
    const provider = providers.find(p => p.key === integration);
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
          <SubHeader isInstalled={isInstalled}>
            {isInstalled ? t('Installed') : t('Not Installed')}
          </SubHeader>
        </MiddleWrapper>
        {isInstalled ? (
          <StyledIconCheckmark isCircled color="green400" />
        ) : (
          isActive && <WaitingIndicator />
        )}
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
  color: ${p =>
    p.isInstalled ? p.theme.successText : p.theme.charts.getColorPalette(5)[4]};
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

const indicatorAnimation: Variants = {
  initial: {opacity: 0, y: -10},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0, y: 10},
};

const WaitingIndicator = styled(motion.div)`
  margin: 0 6px;
  flex-shrink: 0;
  ${pulsingIndicatorStyles};
  background-color: ${p => p.theme.charts.getColorPalette(5)[4]};
`;
const StyledIconCheckmark = styled(IconCheckmark)`
  flex-shrink: 0;
`;

WaitingIndicator.defaultProps = {
  variants: indicatorAnimation,
  transition: testableTransition(),
};

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
