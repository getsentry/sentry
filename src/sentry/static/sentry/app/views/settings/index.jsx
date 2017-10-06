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
            <Box w={240}>
              <SettingsNavSection>
                <SettingsHeading>Configuration</SettingsHeading>
                <SettingsNavItem active={true} label="General" />
                <SettingsNavItem label="Alerts" />
                <SettingsNavItem label="Tags" />
                <SettingsNavItem label="Issue Tracking" />
                <SettingsNavItem label="Release Tracking" />
                <SettingsNavItem label="Data Forwarding" />
                <SettingsNavItem label="Saved Searches" />
                <SettingsNavItem label="Debug information files" />
                <SettingsNavItem label="Processing issues" />
              </SettingsNavSection>

              <SettingsNavSection>
                <SettingsHeading>Data</SettingsHeading>
                <SettingsNavItem label="Basic configuration" />
                <SettingsNavItem label="CSP Reports" />
                <SettingsNavItem label="User feedback" />
                <SettingsNavItem label="Client Keys (DSN)" />
              </SettingsNavSection>

              <SettingsNavSection>
                <SettingsHeading>Integrations</SettingsHeading>
                <SettingsNavItem label="Add a new integration" />
              </SettingsNavSection>
            </Box>
            <Box flex="1">
              <SettingsPanel>
                <SettingsPanelHeader>
                  <SettingsPanelHeaderHeading>
                    Project Details
                  </SettingsPanelHeaderHeading>
                </SettingsPanelHeader>
                <SettingsPanelBody>
                  <SettingsPanelItem
                    label="Project name"
                    required={true}
                    type="text"
                    placeholder="Enter a project name..."
                    defaultValue="Freight"
                    help=""
                  />
                  <SettingsPanelItem
                    error={true}
                    label="Short name"
                    required={true}
                    type="text"
                    placeholder="Enter a short name..."
                    defaultValue="freight"
                    help="A unique ID used to identify this project."
                  />
                  <SettingsPanelItem
                    label="Team"
                    required={true}
                    type="dropdown"
                    placeholder="Choose a team..."
                    defaultValue="freight"
                  />
                  <SettingsPanelItem
                    label="Email subject prefix"
                    required={true}
                    type="text"
                    placeholder="Enter a subject prefix..."
                    defaultValue="[FRGHT]"
                  />
                </SettingsPanelBody>
              </SettingsPanel>

              <SettingsPanel>
                <SettingsPanelHeader>
                  <SettingsPanelHeaderHeading>Event Settings</SettingsPanelHeaderHeading>
                </SettingsPanelHeader>
                <SettingsPanelBody>
                  <SettingsPanelItem
                    label="Allow shared issues"
                    required={true}
                    type="switch"
                    help="Enable sharing of limited details on issues to anonymous users."
                  />
                  <SettingsPanelItem
                    label="Enhanced security"
                    required={true}
                    type="switch"
                    help="Limits personally identifiable information (PII) and removes source code from alerts."
                  />
                  <SettingsPanelItem
                    label="Global sensitive fields"
                    placeholder="Add a field..."
                    type="textarea"
                    help="What does this do?"
                  />
                  <SettingsPanelItem
                    label="Global safe fields"
                    placeholder="Add a field..."
                    type="textarea"
                    help="What does this do?"
                  />
                </SettingsPanelBody>
              </SettingsPanel>
            </Box>
          </Flex>
        </SettingsContainer>
      </SettingsWrapper>
    );
  }
});

const SettingsPanelItem = React.createClass({
  getInitialState() {
    return {
      hover: false
    };
  },
  toggleHover: function() {
    this.setState({hover: !this.state.hover});
  },
  render() {
    let {
      label,
      required,
      type,
      help,
      placeholder,
      defaultValue,
      error,
      ...props
    } = this.props;
    return (
      <SettingsPanelItemWrapper
        onMouseEnter={this.toggleHover}
        onMouseLeave={this.toggleHover}
        error={error}>
        <SettingsPanelItemDesc>
          <SettingsPanelItemLabel error={error}>
            {label} {required && <SettingsRequiredBadge error={error} />}
          </SettingsPanelItemLabel>
          {help && <SettingsPanelItemHelp error={error}>{help}</SettingsPanelItemHelp>}
        </SettingsPanelItemDesc>
        <SettingsPanelItemCtrl>
          {(type == 'text' || type == 'email' || type == 'password') &&
            <SettingsInput
              hover={this.state.hover}
              type={type}
              placeholder={placeholder}
              defaultValue={defaultValue}
              error={error}
            />}
          {type == 'switch' && <Switch size="lg" error={error} />}
          {type == 'textarea' &&
            <SettingsTextarea
              placeholder={placeholder}
              hover={this.state.hover}
              error={error}
            />}
          {error && <SettingsErrorReason>Why'd this break yo?</SettingsErrorReason>}
        </SettingsPanelItemCtrl>
      </SettingsPanelItemWrapper>
    );
  }
});

const SettingsInput = React.createClass({
  render() {
    let {type, placeholder, defaultValue, hover, error, ...props} = this.props;
    return (
      <div>
        <SettingsInputField
          type={type}
          placeholder={placeholder}
          defaultValue={defaultValue}
          hover={hover}
          error={error}
        />
      </div>
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
  styled(({label, ...props}) => <Link {...props} children={label} />)`
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

const SettingsPanelItemWrapper = withTheme(
  styled(Flex)`
    padding: 15px 20px;
    border-bottom: 1px solid ${p => p.theme.borderLight};
    align-items: center;
    transition: background .15s;

    ${p => {
    if (p.error) {
      return css`
        background: ${p.theme.alert.error.background};
        border: 1px solid ${p.theme.alert.error.border};
        margin: -1px -1px 0;
      `;
    }
  }}

    &:last-child {
      border-bottom: none;
    }
  `
);

const SettingsPanelItemDesc = styled(Box)`
  width: 50%;
  padding-right: 10px;
`;

const SettingsRequiredBadge = withTheme(
  styled.div`
    display: inline-block;
    background: ${p => (p.error ? p.theme.alert.error.textLight : p.theme.gray2)};
    width: 5px;
    height: 5px;
    border-radius: 5px;
    text-indent: -9999em;
    vertical-align: super;
  `
);

const SettingsPanelItemLabel = styled.div`
  color: ${p => (p.error ? p.theme.alert.error.textDark : p.theme.gray5)};
`;

const SettingsPanelItemHelp = styled.div`
  color: ${p => (p.error ? p.theme.alert.error.textLight : p.theme.gray2)};
  font-size: 14px;
  margin-top: 8px;
  line-height: 1.4;
`;

const SettingsPanelItemCtrl = styled(Box)`
  color: ${p => p.theme.gray3};
  width: 50%;
  padding-left: 10px;
  position: relative;
`;

const inputStyles = props => css`
  color: ${props.theme.gray5};
  display: block;
  width: 100%;
  border: 0;
  padding: 10px;
  transition: border .2s ease;

  &:focus {
    outline: none;
    background: ${p => (props.error ? '#fff' : '#f7f7f9')};
    border-bottom-color: ${p => props.theme.blue};
  }

  ${p => {
  if (props.hover) {
    return css`
      background: ${p => (props.error ? '#fff' : props.theme.offWhite)};
      `;
  }
}}

 ${p => {
  if (props.error) {
    return css`
    box-shadow: 0 0 0 1px ${props.theme.alert.error.border};
    &:hover:focus {
      background: #fff !important;
    }
    `;
  }
}}

  &::placeholder {
    color: ${props.theme.gray2};
  }
`;

const SettingsErrorReason = withTheme(
  styled.div`
    color: ${p => p.theme.alert.error.textLight};
    position: absolute;
    left: 9px;
    background: #fff;
    padding: 8px 10px;
    font-size: 12px;
    border: 1px solid ${p => p.theme.alert.error.border};
  `
);

const SettingsInputField = styled.input`
  ${inputStyles};

`;

const SettingsTextarea = styled.textarea`
  ${inputStyles};

`;

export default Settings;
