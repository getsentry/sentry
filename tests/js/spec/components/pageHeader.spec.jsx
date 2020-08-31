import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import PageHeading from 'app/components/pageHeading';

describe('PageHeading', function() {
  it('renders', function() {
    const wrapper = mountWithTheme(<PageHeading>New Header</PageHeading>);
    expect(wrapper).toSnapshot();
  });
});
