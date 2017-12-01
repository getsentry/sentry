import React from 'react';
import styled from 'react-emotion';
import {Flex, Box} from 'grid-emotion';
import Link from '../../components/link';

import SettingsLayout from './settingsLayout';
import Panel from './components/panel';
import PanelHeader from './components/panelHeader';
import PanelBody from './components/panelBody';

class SettingsIndex extends React.Component {
  render() {
    return (
      <SettingsLayout {...this.props}>
        <Flex mx={-2} wrap>
          <Box w={1 / 3} px={2}>
            <Panel>
              <HomePanelHeader>
                <HomeIcon color="blue" />
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
                <HomeIcon />
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
                <HomeIcon />
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
                <HomeIcon />
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
                <HomeIcon />
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
                <HomeIcon />
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
  background: ${p => p.theme.blue};
  width: 76px;
  height: 76px;
  border-radius: 76px;
  margin: 0 auto 20px;
`;

const HomeLink = styled(Link)`
  color: ${p => p.theme.purple};

  &:hover {
    color: ${p => p.theme.purpleDark};
  }
`;

export default SettingsIndex;
