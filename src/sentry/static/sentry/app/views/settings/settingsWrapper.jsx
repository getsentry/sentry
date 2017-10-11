import $ from 'jquery';
import React from 'react';
import styled from 'react-emotion';
import {withTheme} from 'emotion-theming';

const StyledSettingsWrapper = withTheme(
  styled.div`
    font-family: 'Rubik', sans-serif;
    font-size: 16px;
    color: ${p => p.theme.gray5};
  `
);
const StyledSettingsContainer = styled.div`
  max-width: 960px;
  padding: 0 16px;
  margin: 0 auto;
  line-height: 1;
`;

class SettingsWrapper extends React.Component {
  componentWillMount() {
    $(document.body).addClass('settings');
  }
  componentWillUnmount() {
    $(document.body).removeClass('settings');
  }

  render() {
    return (
      <StyledSettingsWrapper>
        <StyledSettingsContainer>{this.props.children}</StyledSettingsContainer>
      </StyledSettingsWrapper>
    );
  }
}

export default SettingsWrapper;
