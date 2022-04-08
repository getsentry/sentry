import {mountWithTheme} from 'sentry-test/enzyme';

import {Indicator} from 'sentry/views/onboarding/components/firstEventIndicator';

describe('FirstEventIndicator', function () {
  it('renders waiting status', async function () {
    const org = TestStubs.Organization();

    const wrapper = mountWithTheme(<Indicator organization={org} firstIssue={null} />);

    expect(wrapper.find('WaitingIndicator').exists()).toBe(true);
  });

  describe('received first event', function () {
    it('renders', function () {
      const org = TestStubs.Organization();

      const wrapper = mountWithTheme(
        <Indicator organization={org} firstIssue={{id: 1}} />
      );

      expect(wrapper.find('ReceivedIndicator').exists()).toBe(true);
    });

    it('renders without a known issue ID', async function () {
      const org = TestStubs.Organization();
      const project = TestStubs.ProjectDetails({});

      const wrapper = mountWithTheme(
        <Indicator organization={org} project={project} firstIssue />
      );

      // No button when there is no known issue ID
      expect(wrapper.find('ReceivedIndicator').exists()).toBe(true);
    });
  });
});
