import React from 'react';
import {mount} from 'enzyme';
import {ThemeProvider} from 'emotion-theming';
import theme from 'app/utils/theme';

export function mountWithTheme(component, ...props) {
  return mount(<ThemeProvider theme={theme}>{component}</ThemeProvider>, ...props);
}
