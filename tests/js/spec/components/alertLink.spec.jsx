import theme from '../../../../src/sentry/static/sentry/app/utils/theme';

import {ThemeProvider} from 'emotion-theming';

import React from 'react';
import {mount, shallow} from 'enzyme';
import AlertLink from 'app/components/alertLink';

describe('AlertLink', function() {
  it('renders', function() {
    let wrapper = shallow(
      <ThemeProvider theme={theme}>
        <AlertLink to="/settings/accounts/notifications">
          This is an external link button
        </AlertLink>
      </ThemeProvider>
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('renders with icon', function() {
    let wrapper = mount(
      <ThemeProvider theme={theme}>
        <AlertLink to="/settings/accounts/notifications" icon="icon-mail">
          This is an external link button
        </AlertLink>
      </ThemeProvider>
    );
    expect(wrapper).toPercy();
    expect(wrapper).toMatchSnapshot();
  });
});
