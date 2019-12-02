import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';
import LightWeightInstallPromptBanner from 'app/views/organizationDetails/lightWeightInstallPromptBanner';
import ProjectsStore from 'app/stores/projectsStore';

describe('LightWeightInstallPromptBanner', function() {
  it('renders', async function() {
    const project1 = TestStubs.Project();
    const project2 = TestStubs.Project({firstEvent: null});
    const organization = TestStubs.Organization({slug: 'org-slug'});
    ProjectsStore.loadInitialData([project1, project2]);
    const wrapper = mountWithTheme(
      <LightWeightInstallPromptBanner organization={organization} />,
      TestStubs.routerContext()
    );
    await tick();
    wrapper.update();
    expect(wrapper.find('StyledAlert').exists()).toBe(true);
    expect(wrapper.find('a').text()).toContain('Start capturing errors');
  });
});
