import React from 'react';

import {mount} from 'sentry-test/enzyme';

import Version from 'app/components/version';

const VERSION = 'foo.bar.Baz@1.0.0+20200101';

describe('Version', () => {
  const routerContext = TestStubs.routerContext();

  it('renders', () => {
    const wrapper = mount(<Version version={VERSION} />, routerContext);
    expect(wrapper).toSnapshot();
  });

  it('shows correct parsed version', () => {
    // component uses @sentry/release-parser package for parsing versions
    const wrapper = mount(<Version version={VERSION} />, routerContext);

    expect(wrapper.text()).toBe('1.0.0 (20200101)');
  });

  it('links to release page', () => {
    const wrapper = mount(<Version version={VERSION} projectId="1" />, routerContext);

    expect(
      wrapper
        .find('Link')
        .first()
        .prop('to')
    ).toEqual({
      pathname: '/organizations/org-slug/releases/foo.bar.Baz%401.0.0%2B20200101/',
      query: {project: '1'},
    });
  });

  it('shows raw version in tooltip', () => {
    const wrapper = mount(<Version version={VERSION} tooltipRawVersion />, routerContext);

    const tooltipContent = mount(wrapper.find('Tooltip').prop('title'));

    expect(tooltipContent.text()).toBe(VERSION);
  });
});
