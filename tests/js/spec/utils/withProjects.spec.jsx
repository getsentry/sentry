import {enzymeRender} from 'sentry-test/enzyme';
import {act} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import withProjects from 'sentry/utils/withProjects';

describe('withProjects HoC', function () {
  beforeEach(() => {
    act(() => ProjectsStore.reset());
  });

  it('works', function () {
    const MyComponent = () => null;
    const Container = withProjects(MyComponent);
    const wrapper = enzymeRender(<Container />);

    expect(wrapper.find('MyComponent').prop('projects')).toEqual([]);
    expect(wrapper.find('MyComponent').prop('loadingProjects')).toEqual(true);

    // Insert into projects store
    const project = TestStubs.Project();
    act(() => ProjectsStore.loadInitialData([project]));

    wrapper.update();
    const projectProp = wrapper.find('MyComponent').prop('projects');
    expect(projectProp).toHaveLength(1);
    expect(projectProp[0].id).toBe(project.id);
    const loadingProp = wrapper.find('MyComponent').prop('loadingProjects');
    expect(loadingProp).toBe(false);
  });
});
