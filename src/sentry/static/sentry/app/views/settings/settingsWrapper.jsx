import $ from 'jquery';
import React from 'react';
import styled from 'react-emotion';
import {withTheme} from 'emotion-theming';

const StyledSettingsWrapper = withTheme(
  styled.div`
    font-family: 'Rubik', sans-serif;
    font-size: 16px;
    color: ${p => p.theme.gray5};
    margin: 0 auto;
    line-height: 1;
  `
);

class SettingsWrapper extends React.Component {
  componentWillMount() {
    $(document.body).addClass('new-settings');
  }
  componentWillUnmount() {
    $(document.body).removeClass('new-settings');
  }

  render() {
    return <StyledSettingsWrapper>{this.props.children}</StyledSettingsWrapper>;
  }
}

export default SettingsWrapper;
