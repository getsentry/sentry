import {render, screen} from 'sentry-test/reactTestingLibrary';

import {getMockData} from '../testUtils';

import {AffectOtherProjectsTransactionsAlert} from './affectOtherProjectsTransactionsAlert';

describe("Affect other project's transactions alert", function () {
  it('does not render', function () {
    const {project} = getMockData();

    const {rerender} = render(
      <AffectOtherProjectsTransactionsAlert
        isProjectIncompatible
        projectSlug={project.slug}
        affectedProjects={[project]}
      />
    );

    expect(screen.queryByText(/This rate will affect/)).not.toBeInTheDocument(); // project is incompatible

    rerender(
      <AffectOtherProjectsTransactionsAlert
        isProjectIncompatible={false}
        projectSlug={project.slug}
        affectedProjects={[project]}
      />
    );

    expect(screen.queryByText(/This rate will affect/)).not.toBeInTheDocument(); // there is only one affected project and it is the current project

    rerender(
      <AffectOtherProjectsTransactionsAlert
        isProjectIncompatible={false}
        projectSlug={project.slug}
        affectedProjects={[]}
      />
    );

    expect(screen.queryByText(/This rate will affect/)).not.toBeInTheDocument(); // there is no affected project
  });

  it('renders', function () {
    const {projects} = getMockData();

    render(
      <AffectOtherProjectsTransactionsAlert
        isProjectIncompatible={false}
        projectSlug="some-project-slug"
        affectedProjects={projects}
      />
    );

    expect(screen.getByText(/This rate will affect/)).toBeInTheDocument();
  });
});
