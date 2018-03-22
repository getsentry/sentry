import $ from 'jquery';
import React from 'react';
import styled from 'react-emotion';

import ScrollToTop from './components/scrollToTop';

const StyledSettingsWrapper = styled.div`
  font-family: 'Rubik', sans-serif;
  font-size: 16px;
  color: ${p => p.theme.gray5};
  margin: 0 auto;
  line-height: 1;

  footer > .container {
    max-width: ${p => p.theme.settings.containerWidth};
    padding: ${p => p.theme.grid * 2}px;
  }
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
        <ScrollToTop>{this.props.children}</ScrollToTop>
      </StyledSettingsWrapper>
    );
  }
}

export default SettingsWrapper;
