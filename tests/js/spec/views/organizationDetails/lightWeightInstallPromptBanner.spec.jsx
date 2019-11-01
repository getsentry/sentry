import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';
import LightWeightInstallPromptBanner from 'app/views/organizationDetails/lightWeightInstallPromptBanner';

describe('LightWeightInstallPromptBanner', function() {
  it('renders', async function() {
    const project1 = TestStubs.Project();
    const project2 = TestStubs.Project({firstEvent: null});
    const organization = TestStubs.Organization({slug: 'org-slug'});
    const getProjectsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project1, project2],
    });
    const wrapper = mountWithTheme(
      <LightWeightInstallPromptBanner organization={organization} />,
      TestStubs.routerContext()
    );
    await tick();
    wrapper.update();
    expect(getProjectsMock).toHaveBeenCalled();
    expect(wrapper.find('StyledAlert').exists()).toBe(true);
    expect(wrapper.find('a').text()).toContain('Start capturing errors');
  });
});
