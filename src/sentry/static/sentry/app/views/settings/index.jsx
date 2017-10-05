import React from 'react';
import {Link} from 'react-router';
import $ from 'jquery';
import styled, {css} from 'react-emotion';
import {Flex, Box} from 'grid-emotion';
import {withTheme} from 'emotion-theming';

import Switch from '../../components/switch';

const Settings = React.createClass({
  componentWillMount() {
    $(document.body).addClass('settings');
  },
  componentWillunMount() {
    $(document.body).addClass('settings');
  },
  render() {
    return (
      <SettingsWrapper>
        <SettingsContainer>
          <SettingsHeader>
            <Box flex="1">Settings &gt; Projects &gt; Freight &gt; General</Box>
            <SettingsActivity>Saving dem changes...</SettingsActivity>
          </SettingsHeader>
          <Flex>
            <Box w={210}>
              <SettingsNavSection>
                <SettingsHeading>Configuration</SettingsHeading>
                <SettingsNavItem active={true}>General</SettingsNavItem>
                <SettingsNavItem>Alerts</SettingsNavItem>
                <SettingsNavItem>Tags</SettingsNavItem>
                <SettingsNavItem>Issue Tracking</SettingsNavItem>
                <SettingsNavItem>Release Tracking</SettingsNavItem>
                <SettingsNavItem>Data Forwarding</SettingsNavItem>
                <SettingsNavItem>Saved Searches</SettingsNavItem>
                <SettingsNavItem>Debug information files</SettingsNavItem>
                <SettingsNavItem>Processing issues</SettingsNavItem>
              </SettingsNavSection>

              <SettingsNavSection>
                <SettingsHeading>Data</SettingsHeading>
                <SettingsNavItem>Basic configuration</SettingsNavItem>
                <SettingsNavItem>CSP Reports</SettingsNavItem>
                <SettingsNavItem>User feedback</SettingsNavItem>
                <SettingsNavItem>Client Keys (DSN)</SettingsNavItem>
              </SettingsNavSection>

              <SettingsNavSection>
                <SettingsHeading>Integrations</SettingsHeading>
                <SettingsNavItem>Add a new integration</SettingsNavItem>
              </SettingsNavSection>
            </Box>
            <Box flex="1">
              <SettingsPanel>
                <SettingsPanelHeader>
                  <SettingsPanelHeaderHeading>Project Details</SettingsPanelHeaderHeading>
                </SettingsPanelHeader>
                <SettingsPanelBody>
                  <SettingsPanelItem>
                    <SettingsPanelItemDesc>
                      <SettingsPanelItemLabel>Project name</SettingsPanelItemLabel>
                    </SettingsPanelItemDesc>
                    <SettingsPanelItemCtrl>
                      <SettingsInput type="text" defaultValue="Freight" />
                    </SettingsPanelItemCtrl>
                  </SettingsPanelItem>

                  <SettingsPanelItem>
                    <SettingsPanelItemDesc>
                      <SettingsPanelItemLabel>Short name</SettingsPanelItemLabel>
                    </SettingsPanelItemDesc>
                    <SettingsPanelItemCtrl>
                      <SettingsInput type="text" defaultValue="freight" />
                    </SettingsPanelItemCtrl>
                  </SettingsPanelItem>

                  <SettingsPanelItem>
                    <SettingsPanelItemDesc>
                      <SettingsPanelItemLabel>Team</SettingsPanelItemLabel>
                    </SettingsPanelItemDesc>
                    <SettingsPanelItemCtrl>
                      <SettingsInput type="text" defaultValue="Freight" />
                    </SettingsPanelItemCtrl>
                  </SettingsPanelItem>

                  <SettingsPanelItem>
                    <SettingsPanelItemDesc>
                      <SettingsPanelItemLabel>
                        Email subject prefix
                      </SettingsPanelItemLabel>
                    </SettingsPanelItemDesc>
                    <SettingsPanelItemCtrl>
                      <SettingsInput type="text" placeholder="[ACME]" />
                    </SettingsPanelItemCtrl>
                  </SettingsPanelItem>

                </SettingsPanelBody>
              </SettingsPanel>

              <SettingsPanel>
                <SettingsPanelHeader>
                  <SettingsPanelHeaderHeading>Event Settings</SettingsPanelHeaderHeading>
                </SettingsPanelHeader>
                <SettingsPanelBody>
                  <SettingsPanelItem>
                    <SettingsPanelItemDesc>
                      <SettingsPanelItemLabel>Allow shared issues</SettingsPanelItemLabel>
                      <SettingsPanelItemHelp>
                        Enable sharing of limited details on issues to anonymous users.
                      </SettingsPanelItemHelp>
                    </SettingsPanelItemDesc>
                    <SettingsPanelItemCtrl>
                      <Switch size="lg" />
                    </SettingsPanelItemCtrl>
                  </SettingsPanelItem>

                  <SettingsPanelItem>
                    <SettingsPanelItemDesc>
                      <SettingsPanelItemLabel>Enhanced security</SettingsPanelItemLabel>
                      <SettingsPanelItemHelp>
                        Limits personally identifiable information (PII) and removes source code from alerts.
                      </SettingsPanelItemHelp>
                    </SettingsPanelItemDesc>
                    <SettingsPanelItemCtrl>
                      <Switch size="lg" />
                    </SettingsPanelItemCtrl>
                  </SettingsPanelItem>

                  <SettingsPanelItem>
                    <SettingsPanelItemDesc>
                      <SettingsPanelItemLabel>
                        Global sensitive fields
                      </SettingsPanelItemLabel>
                    </SettingsPanelItemDesc>
                    <SettingsPanelItemCtrl>...</SettingsPanelItemCtrl>
                  </SettingsPanelItem>

                  <SettingsPanelItem>
                    <SettingsPanelItemDesc>
                      <SettingsPanelItemLabel>
                        Global safe fields
                      </SettingsPanelItemLabel>
                    </SettingsPanelItemDesc>
                    <SettingsPanelItemCtrl>...</SettingsPanelItemCtrl>
                  </SettingsPanelItem>

                </SettingsPanelBody>
              </SettingsPanel>
            </Box>
          </Flex>
        </SettingsContainer>
      </SettingsWrapper>
    );
  }
});

const SettingsWrapper = withTheme(
  styled.div`
    font-family: "Rubik", sans-serif;
    font-size: 16px;
    color: ${p => p.theme.gray5};
  `
);

const SettingsContainer = styled.div`
  max-width: 960px;
  padding: 0 16px;
  margin: 0 auto;
  line-height: 1;
`;

const SettingsHeader = styled(Flex)`
  margin-bottom: 60px;
  align-items: center;
`;

const SettingsActivity = withTheme(
  styled(Box)`
    font-size: 14px;
    color: ${p => p.theme.gray2};
  `
);

const SettingsHeading = styled.div`
  color: ${p => p.theme.gray3};
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 20px;
`;

const SettingsNavSection = styled.div`
  margin-bottom: 20px;
`;

const SettingsNavItem = withTheme(
  styled(Link)`
    display: block;
    color: ${p => (p.active === true ? p.theme.gray5 : p.theme.gray2)};
    font-size: 14px;
    line-height: 30px;
    position: relative;

    &:hover, &:focus, &:active {
      color: ${p => p.theme.gray5};
    }

    &:before {
      position: absolute;
      content: '';
      display: block;
      top: 8px;
      left: -22px;
      height: 14px;
      width: 2px;
      background: ${p => (p.active === true ? p.theme.purple : 'transparent')};
      border-radius: 1px;
    }
  `
);

const SettingsPanel = styled.div`
  background: #fff;
  border-radius: ${p => p.theme.radius};
  border: 1px solid ${p => p.theme.borderDark};
  box-shadow: ${p => p.theme.dropShadowLight};
  margin-bottom: 30px;
`;

const SettingsPanelHeader = styled.div`
  border-bottom: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.radius} ${p => p.theme.radius} 0 0;
  background: ${p => p.theme.offWhite}
  padding: 15px 20px;
`;

const SettingsPanelHeaderHeading = styled(SettingsHeading)`
  font-size: 13px;
  margin: 0;
`;

const SettingsPanelBody = styled.div`

`;

const SettingsPanelItem = styled(Flex)`
  padding 15px 20px;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  align-items: center;

  &:last-child {
    border-bottom: none;
  }
`;

const SettingsPanelItemDesc = styled(Box)`
  width: 50%;
  overflow: hidden;
  padding-right: 10px;
`;

const SettingsPanelItemLabel = styled.div`
  color: ${p => p.theme.gray5};
`;

const SettingsPanelItemHelp = styled.div`
  color: ${p => p.theme.gray2};
  font-size: 14px;
  margin-top: 8px;
  line-height: 1.4;
`;

const SettingsPanelItemCtrl = styled(Box)`
  color: ${p => p.theme.gray3};
  overflow: hidden;
  width: 50%;
  padding-left: 10px;
`;

const inputStyles = props => css`
  color: ${props.theme.gray5};
  display: block;
  width: 100%;
  border: 0;
  background: #fbfbfc;
  padding: 7px 12px;
  transition: border .2s ease;
  border-top: 2px solid #fafafb;
  border-bottom: 2px solid #fbfbfc;

  &:focus {
    outline: none;
  }

  &::placeholder {
    color: ${props.theme.gray2};
  }
`;

const SettingsInput = withTheme(
  styled.input`
  ${inputStyles};

  &:focus {
    outline: none;
    border-bottom-color: ${p => p.theme.blue};
  }
`
);

export default Settings;
