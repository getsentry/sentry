import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Indicator} from 'app/views/onboarding/projectSetup/firstEventIndicator';

describe('FirstEventIndicator', function () {
  it('renders waiting status', async function () {
    const org = TestStubs.Organization();

    const wrapper = mountWithTheme(
      <Indicator organization={org} firstIssue={null} />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('WaitingIndicator').exists()).toBe(true);
  });

  describe('received first event', function () {
    it('renders', function () {
      const org = TestStubs.Organization();

      const wrapper = mountWithTheme(
        <Indicator organization={org} firstIssue={{id: 1}} />,
        TestStubs.routerContext()
      );

      expect(wrapper.find('ReceivedIndicator').exists()).toBe(true);
      expect(wrapper.find('Button').props().to).toBe(
        `/organizations/${org.slug}/issues/1/`
      );
    });

    it('renders without a known issue ID', async function () {
      const org = TestStubs.Organization();
      const project = TestStubs.ProjectDetails({});

      const wrapper = mountWithTheme(
        <Indicator organization={org} project={project} firstIssue />,
        TestStubs.routerContext()
      );

      // No button when there is no known issue ID
      expect(wrapper.find('ReceivedIndicator').exists()).toBe(true);
      expect(wrapper.find('Button').exists()).toBe(false);
    });
  });
});
