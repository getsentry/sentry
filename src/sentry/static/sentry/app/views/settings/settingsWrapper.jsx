import $ from 'jquery';
import React from 'react';
import styled from 'react-emotion';

const StyledSettingsWrapper = styled.div`
  font-family: ${p => p.theme.text.family};
  font-size: 16px;
  color: ${p => p.theme.gray5};
`;

const StyledSettingsContainer = styled.div`
  max-width: 1040px;
  padding: 0 16px;
  margin: 0 auto;
  line-height: 1;
`;

class SettingsWrapper extends React.Component {
  componentWillMount() {
    $(document.body).addClass('new-settings');
  }
  componentWillUnmount() {
    $(document.body).removeClass('new-settings');
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
