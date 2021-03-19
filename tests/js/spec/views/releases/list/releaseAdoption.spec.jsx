import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ReleaseAdoption from 'app/views/releases/list/releaseAdoption';

describe('ReleasesList > ReleaseAdoption', function () {
  it('renders', function () {
    const wrapper = mountWithTheme(
      <ReleaseAdoption adoption={10} releaseCount={100} projectCount={1000} />
    );

    expect(wrapper.find('Labels').exists()).toBeFalsy();
    expect(wrapper.find('ProgressBar').prop('value')).toBe(10);

    const tooltipContent = mountWithTheme(wrapper.find('Tooltip').prop('title'));

    expect(tooltipContent.find('Title').at(0).text()).toBe('This Release');
    expect(tooltipContent.find('Value').at(0).text()).toBe('100 sessions');
    expect(tooltipContent.find('Title').at(1).text()).toBe('Total Project');
    expect(tooltipContent.find('Value').at(1).text()).toBe('1k sessions');
  });

  it('renders with users', function () {
    const wrapper = mountWithTheme(
      <ReleaseAdoption
        adoption={100}
        releaseCount={1}
        projectCount={1}
        displayOption="users"
      />
    );

    const tooltipContent = mountWithTheme(wrapper.find('Tooltip').prop('title'));

    expect(tooltipContent.find('Value').at(0).text()).toBe('1 user');
  });

  it('renders with labels', function () {
    const wrapper = mountWithTheme(
      <ReleaseAdoption
        adoption={100}
        releaseCount={1}
        projectCount={1}
        withLabels
        displayOption="sessions"
      />
    );
    expect(wrapper.find('Labels').text()).toBe('1/1 session100%');

    const wrapper2 = mountWithTheme(
      <ReleaseAdoption
        adoption={10}
        releaseCount={100}
        projectCount={1000}
        withLabels
        displayOption="users"
      />
    );
    expect(wrapper2.find('Labels').text()).toBe('100/1k users10%');
  });
});
