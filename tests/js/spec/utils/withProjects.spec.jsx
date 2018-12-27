import React from 'react';
import {mount} from 'enzyme';

import ProjectsStore from 'app/stores/projectsStore';
import withProjects from 'app/utils/withProjects';

describe('withProjects HoC', function() {
  beforeEach(() => {
    ProjectsStore.reset();
  });

  it('works', function() {
    const MyComponent = () => null;
    let Container = withProjects(MyComponent);
    let wrapper = mount(<Container />);

    expect(wrapper.find('MyComponent').prop('projects')).toEqual([]);

    // Insert into projects store
    let project = TestStubs.Project();
    ProjectsStore.loadInitialData([project]);

    wrapper.update();
    let props = wrapper.find('MyComponent').prop('projects');
    expect(props).toHaveLength(1);
    expect(props[0].id).toBe(project.id);
  });
});
