import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import AlertLink from 'app/components/alertLink';
import {IconMail} from 'app/icons';

describe('AlertLink', function () {
  it('renders', function () {
    const wrapper = mountWithTheme(
      <AlertLink to="/settings/accounts/notifications">
        This is an external link button
      </AlertLink>
    );
    expect(wrapper).toSnapshot();
  });

  it('renders with icon', function () {
    const wrapper = mountWithTheme(
      <AlertLink to="/settings/accounts/notifications" icon={<IconMail />}>
        This is an external link button
      </AlertLink>
    );
    expect(wrapper).toSnapshot();
  });
});
