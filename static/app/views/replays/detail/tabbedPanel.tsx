import {Fragment, ReactNode, useState} from 'react';
import styled from '@emotion/styled';

import NavTabs from 'sentry/components/navTabs';
import {
  Panel as BasePanel,
  Panel as BasePanelBody,
  PanelHeader as BasePanelHeader,
} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

type Props = {
  tabs: {
    name: string;
    render: ReactNode;
  }[];
};

function TabbedPanel({tabs}: Props) {
  const [active, setActive] = useState<string>(tabs[0].name);
  return (
    <Panel>
      <PanelTabs underlined>
        {tabs.map(tab => (
          <li
            key={tab.name}
            className={active === tab.name.toLowerCase() ? 'active' : ''}
          >
            <TabButton onClick={() => setActive(tab.name)}>
              <PanelHeader
                isActive={tab.name === active}
                onClick={() => setActive(tab.name)}
              >
                {t(tab.name)}
              </PanelHeader>
            </TabButton>
          </li>
        ))}
      </PanelTabs>
      <PanelBody>
        {tabs.map(
          tab => tab.name === active && <Fragment key={tab.name}>{tab.render}</Fragment>
        )}
      </PanelBody>
    </Panel>
  );
}

const PanelTabs = styled(NavTabs)`
  margin-bottom: 0;
`;

const TabButton = styled('button')`
  border: none;
  padding: 0;
  background: none;
`;

// FYI: Since the Replay Player has dynamic height based
// on the width of the window,
// height: 0; will helps us to reset the height
// min-height: 100%; will helps us to grow at the same height of Player
const Panel = styled(BasePanel)`
  width: 100%;
  display: grid;
  grid-template-rows: auto 1fr;
  height: 0;
  min-height: 100%;
  @media only screen and (max-width: ${p => p.theme.breakpoints.large}) {
    height: fit-content;
    max-height: 400px;
    margin-top: ${space(2)};
  }
`;

type PanelHeaderProps = {
  isActive: boolean;
};

const PanelHeader = styled(BasePanelHeader)<PanelHeaderProps>`
  background-color: ${p => p.theme.background};
  border-bottom: ${p => (p.isActive ? `3px solid ${p.theme.focusBorder}` : 'none')};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => (p.isActive ? p.theme.gray500 : p.theme.gray300)};
  text-transform: capitalize;
  padding: ${space(1.5)} ${space(1)} ${space(1)};
`;

const PanelBody = styled(BasePanelBody)`
  margin-bottom: 0;
  overflow: hidden;
  border: none;
`;

export default TabbedPanel;
