import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';

import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import ProjectsStore from 'app/stores/projectsStore';

describe('LightWeightNoProjectMessage', function() {
  it('renders', async function() {
    const project1 = TestStubs.Project();
    const project2 = TestStubs.Project();
    const organization = TestStubs.Organization({slug: 'org-slug'});
    delete organization.projects;
    ProjectsStore.loadInitialData([project1, project2]);
    const wrapper = mountWithTheme(
      <LightWeightNoProjectMessage organization={organization}>
        {null}
      </LightWeightNoProjectMessage>,
      TestStubs.routerContext()
    );
    expect(wrapper.prop('children')).toBe(null);
    expect(wrapper.find('NoProjectMessage').exists()).toBe(true);
  });
});
