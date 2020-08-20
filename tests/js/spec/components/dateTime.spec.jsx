import React from 'react';

import {mount} from 'sentry-test/enzyme';

import DateTime from 'app/components/dateTime';
import ConfigStore from 'app/stores/configStore';

describe('DateTime', () => {
  beforeAll(() => {
    const user = TestStubs.User();
    user.options.clock24Hours = false;
    ConfigStore.set('user', user);
  });

  it('renders', () => {
    // const wrapper = mount(<DateTime date="Are you sure?" />);
  });
});
