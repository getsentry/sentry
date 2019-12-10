import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';

import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import ProjectsStore from 'app/stores/projectsStore';

describe('LightWeightNoProjectMessage', function() {
  beforeEach(function() {
    ProjectsStore.reset();
  });

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

  it('does not remount when the projects store loads', async function() {
    const child = jest.fn(() => null);
    const project1 = TestStubs.Project();
    const project2 = TestStubs.Project();
    const organization = TestStubs.Organization({slug: 'org-slug'});
    delete organization.projects;
    const wrapper = mountWithTheme(
      <LightWeightNoProjectMessage organization={organization}>
        {child()}
      </LightWeightNoProjectMessage>,
      TestStubs.routerContext()
    );

    // verify child is called/mounted once
    expect(child).toHaveBeenCalledTimes(1);
    expect(wrapper.find('NoProjectMessage')).toHaveLength(1);
    expect(wrapper.find('NoProjectMessage').prop('loadingProjects')).toEqual(true);

    ProjectsStore.loadInitialData([project1, project2]);
    // await for trigger from projects store to resolve
    await tick();
    wrapper.update();

    // verify child is still only called/mounted once
    expect(child).toHaveBeenCalledTimes(1);
    expect(wrapper.find('NoProjectMessage')).toHaveLength(1);
    expect(wrapper.find('NoProjectMessage').prop('loadingProjects')).toEqual(false);
  });
});
