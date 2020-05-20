import React from 'react';

import {mount} from 'sentry-test/enzyme';

import ProjectsStore from 'app/stores/projectsStore';
import withProjects from 'app/utils/withProjects';

describe('withProjects HoC', function() {
  beforeEach(() => {
    ProjectsStore.reset();
  });

  it('works', function() {
    const MyComponent = () => null;
    const Container = withProjects(MyComponent);
    const wrapper = mount(<Container />);

    expect(wrapper.find('MyComponent').prop('projects')).toEqual([]);
    expect(wrapper.find('MyComponent').prop('loadingProjects')).toEqual(true);

    // Insert into projects store
    const project = TestStubs.Project();
    ProjectsStore.loadInitialData([project]);

    wrapper.update();
    const projectProp = wrapper.find('MyComponent').prop('projects');
    expect(projectProp).toHaveLength(1);
    expect(projectProp[0].id).toBe(project.id);
    const loadingProp = wrapper.find('MyComponent').prop('loadingProjects');
    expect(loadingProp).toBe(false);
  });
});
