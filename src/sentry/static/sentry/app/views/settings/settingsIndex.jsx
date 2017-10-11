import React from 'react';
import styled from 'react-emotion';
import {Flex, Box} from 'grid-emotion';
import Link from '../../components/link';

import SettingsLayout from './settingsLayout';
import Panel from './components/panel';
import PanelHeader from './components/panelHeader';
import PanelBody from './components/panelBody';

import IconDocs from '../../icons/icon-docs';
import IconLaptop from '../../icons/icon-laptop';
import IconLock from '../../icons/icon-lock';
import IconStack from '../../icons/icon-stack';
import IconSupport from '../../icons/icon-support';
import IconUser from '../../icons/icon-user';

class SettingsIndex extends React.Component {
  render() {
    return (
      <SettingsLayout {...this.props}>
        <Flex mx={-2} wrap>
          <Box w={1 / 3} px={2}>
            <Panel>
              <HomePanelHeader>
                <HomeIcon color="blue">
                  <IconUser size={44} />
                </HomeIcon>
                My Account
              </HomePanelHeader>
              <HomePanelBody>
                <h3>Quick links:</h3>
                <ul>
                  <li>
                    <HomeLink>Change my password</HomeLink>
                  </li>
                  <li>
                    <HomeLink>Notification Preferences</HomeLink>
                  </li>
                  <li>
                    <HomeLink>Change my avatar</HomeLink>
                  </li>
                </ul>
              </HomePanelBody>
            </Panel>
          </Box>
          <Box w={1 / 3} px={2}>
            {/* if admin */}
            <Panel>
              <HomePanelHeader>
                <HomeIcon color="green">
                  <IconStack size={44} />
                </HomeIcon>
                Organization Name
              </HomePanelHeader>
              <HomePanelBody>
                <h3>Quick links:</h3>
                <ul>
                  <li>
                    <HomeLink>Usage & Billing</HomeLink>
                  </li>
                  <li>
                    <HomeLink>Projects & Teams</HomeLink>
                  </li>
                  <li>
                    <HomeLink>Audit log</HomeLink>
                  </li>
                </ul>
              </HomePanelBody>
            </Panel>
          </Box>
          <Box w={1 / 3} px={2}>
            <Panel>
              <HomePanelHeader>
                <HomeIcon color="orange">
                  <IconDocs size={48} />
                </HomeIcon>
                Documentation
              </HomePanelHeader>
              <HomePanelBody>
                <h3>Quick links:</h3>
                <ul>
                  <li>
                    <HomeLink>Quickstart Guide</HomeLink>
                  </li>
                  <li>
                    <HomeLink>Platforms & Frameworks</HomeLink>
                  </li>
                  <li>
                    <HomeLink>Sentry CLI</HomeLink>
                  </li>
                </ul>
              </HomePanelBody>
            </Panel>
          </Box>
          <Box w={1 / 3} px={2}>
            <Panel>
              <HomePanelHeader>
                <HomeIcon color="purple">
                  <IconSupport size={48} />
                </HomeIcon>
                Support
              </HomePanelHeader>
              <HomePanelBody>
                <h3>Quick links:</h3>
                <ul>
                  <li>
                    <HomeLink>Contact Support</HomeLink>
                    {/* or community forums if self-hosted */}
                  </li>
                  <li>
                    <HomeLink>Sentry on GitHub</HomeLink>
                  </li>
                  <li>
                    <HomeLink>Service Status</HomeLink>
                  </li>
                </ul>
              </HomePanelBody>
            </Panel>
          </Box>
          <Box w={1 / 3} px={2}>
            <Panel>
              <HomePanelHeader>
                <HomeIcon color="red">
                  <IconLaptop size={48} />
                </HomeIcon>
                Server Admin
              </HomePanelHeader>
              <HomePanelBody>
                <h3>Quick links:</h3>
                <ul>
                  <li>
                    <HomeLink>Contact Support</HomeLink>
                    {/* or community forums if self-hosted */}
                  </li>
                  <li>
                    <HomeLink>Sentry on GitHub</HomeLink>
                  </li>
                  <li>
                    <HomeLink>Service Status</HomeLink>
                  </li>
                </ul>
              </HomePanelBody>
            </Panel>
          </Box>
          <Box w={1 / 3} px={2}>
            <Panel>
              <HomePanelHeader>
                <HomeIcon>
                  <IconLock size={48} />
                </HomeIcon>
                API Keys
              </HomePanelHeader>
              <HomePanelBody>
                <h3>Quick links:</h3>
                <ul>
                  <li>
                    <HomeLink>Contact Support</HomeLink>
                    {/* or community forums if self-hosted */}
                  </li>
                  <li>
                    <HomeLink>Sentry on GitHub</HomeLink>
                  </li>
                  <li>
                    <HomeLink>Service Status</HomeLink>
                  </li>
                </ul>
              </HomePanelBody>
            </Panel>
          </Box>
        </Flex>
      </SettingsLayout>
    );
  }
}

const HomePanelHeader = styled(PanelHeader)`
  background: #fff;
  text-align: center;
  font-size: 18px;
  text-transform: unset;
  padding: 35px 30px;
`;

const HomePanelBody = styled(PanelBody)`
  padding: 30px;

  h3 {
    font-size: 14px;
  }

  ul {
    margin: 0;
    li {
      line-height: 1.6;
      /* Bullet color */
      color: ${p => p.theme.gray1};
    }
  }
`;

const HomeIcon = styled.div`
  background: ${p => p.theme[p.color || 'gray2']};
  color: #fff;
  width: 76px;
  height: 76px;
  border-radius: 76px;
  margin: 0 auto 20px;
  > svg {
    margin-top: 14px;
  }
`;

const HomeLink = styled(Link)`
  color: ${p => p.theme.purple};

  &:hover {
    color: ${p => p.theme.purpleDark};
  }
`;

export default SettingsIndex;
