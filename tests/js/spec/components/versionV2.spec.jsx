import React from 'react';

import {mount} from 'sentry-test/enzyme';
import Version from 'app/components/version';

const VERSION = 'foo.bar.Baz@1.0.0+20200101';
const ORG_ID = 'sentry';

describe('Version', () => {
  it('renders', () => {
    const wrapper = mount(<Version version={VERSION} orgId={ORG_ID} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('shows correct parsed version', () => {
    // component uses @sentry/release-parser package for parsing versions
    const wrapper = mount(<Version version={VERSION} orgId={ORG_ID} />);

    expect(wrapper.text()).toBe('1.0.0 (20200101)');
  });

  it('links to release page', () => {
    const wrapper = mount(<Version version={VERSION} orgId={ORG_ID} projectId="1" />);

    expect(wrapper.find('Link').prop('to')).toEqual({
      pathname: '/organizations/sentry/releases/foo.bar.Baz%401.0.0%2B20200101/',
      query: {project: '1'},
    });
  });

  it('shows raw version in tooltip', () => {
    const wrapper = mount(<Version version={VERSION} orgId={ORG_ID} tooltipRawVersion />);

    const tooltipContent = mount(wrapper.find('Tooltip').prop('title'));

    expect(tooltipContent.text()).toBe(VERSION);
  });
});
