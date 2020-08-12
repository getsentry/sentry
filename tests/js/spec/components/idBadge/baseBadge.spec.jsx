import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import BaseBadge from 'app/components/idBadge/baseBadge';

describe('BadgeBadge', function() {
  it('has a display name', function() {
    const wrapper = mountWithTheme(
      <BaseBadge
        organization={TestStubs.Organization()}
        displayName={<span id="test">display name</span>}
      />,
      TestStubs.routerContext()
    );
    expect(wrapper.find('#test')).toHaveLength(1);
    expect(wrapper.find('#test').text()).toBe('display name');
  });

  it('can hide avatar', function() {
    const wrapper = mountWithTheme(
      <BaseBadge organization={TestStubs.Organization()} hideAvatar />,
      TestStubs.routerContext()
    );
    expect(wrapper.find('StyledAvatar')).toHaveLength(0);
  });

  it('can hide name', function() {
    const wrapper = mountWithTheme(
      <BaseBadge
        organization={TestStubs.Organization()}
        hideName
        displayName={<span id="test">display name</span>}
      />,
      TestStubs.routerContext()
    );
    expect(wrapper.find('#test')).toHaveLength(0);
  });
});
