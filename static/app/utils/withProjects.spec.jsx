import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import withProjects from 'sentry/utils/withProjects';

describe('withProjects HoC', function () {
  beforeEach(() => {
    act(() => ProjectsStore.reset());
  });

  function Output({projects, loadingProjects}) {
    if (loadingProjects) {
      return <p>Loading</p>;
    }
    return (
      <p>
        {projects.map(project => (
          <span key={project.slug}>{project.slug}</span>
        ))}
      </p>
    );
  }

  it('works', async function () {
    const Container = withProjects(Output);
    render(<Container />);
    expect(await screen.findByText('Loading')).toBeInTheDocument();

    // Insert into projects store
    const project = TestStubs.Project();
    act(() => ProjectsStore.loadInitialData([project]));

    expect(await screen.findByText(project.slug)).toBeInTheDocument();
  });
});
