import React from 'react';
import {shallow} from 'sentry-test/enzyme';
import AlertLink from 'app/components/alertLink';

describe('AlertLink', function() {
  it('renders', function() {
    const wrapper = shallow(
      <AlertLink to="/settings/accounts/notifications">
        This is an external link button
      </AlertLink>
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('renders with icon', function() {
    const wrapper = shallow(
      <AlertLink to="/settings/accounts/notifications" icon="icon-mail">
        This is an external link button
      </AlertLink>
    );
    expect(wrapper).toMatchSnapshot();
  });
});
