import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';

import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';

describe('LightWeightNoProjectMessage', function() {
  it('renders', async function() {
    const project1 = TestStubs.Project();
    const project2 = TestStubs.Project();
    const organization = TestStubs.Organization({slug: 'org-slug'});
    delete organization.projects;
    const getProjectsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project1, project2],
    });
    const wrapper = mountWithTheme(
      <LightWeightNoProjectMessage organization={organization}>
        {null}
      </LightWeightNoProjectMessage>,
      TestStubs.routerContext()
    );
    expect(wrapper.prop('children')).toBe(null);
    // await fetching projects
    await tick();
    wrapper.update();
    expect(getProjectsMock).toHaveBeenCalled();
    expect(wrapper.find('NoProjectMessage').exists()).toBe(true);
  });
});
