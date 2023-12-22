import {Project as ProjectFixture} from 'sentry-fixture/project';
import {Team} from 'sentry-fixture/team';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectTeamAccess from 'sentry/views/projectDetail/projectTeamAccess';

describe('ProjectDetail > ProjectTeamAccess', function () {
  const {organization, routerContext} = initializeOrg();

  it('renders a list', function () {
    render(
      <ProjectTeamAccess
        organization={organization}
        project={ProjectFixture({teams: [Team()]})}
      />,
      {context: routerContext}
    );

    expect(screen.getByText('Team Access')).toBeInTheDocument();
    expect(screen.getByText('#team-slug')).toBeInTheDocument();
  });

  it('links to a team settings', function () {
    render(
      <ProjectTeamAccess
        organization={organization}
        project={ProjectFixture({teams: [Team()]})}
      />,
      {context: routerContext}
    );

    expect(screen.getByRole('link', {name: '#team-slug'})).toHaveAttribute(
      'href',
      '/settings/org-slug/teams/team-slug/'
    );
  });

  it('display the right empty state with access', function () {
    render(<ProjectTeamAccess organization={organization} project={ProjectFixture()} />, {
      context: routerContext,
    });

    expect(screen.getByRole('button', {name: 'Assign Team'})).toHaveAttribute(
      'href',
      '/settings/org-slug/projects/project-slug/teams/'
    );
  });

  it('display the right empty state without access', function () {
    render(
      <ProjectTeamAccess
        organization={{...organization, access: []}}
        project={ProjectFixture({teams: []})}
      />,
      {context: routerContext}
    );
    expect(screen.getByRole('button', {name: 'Assign Team'})).toBeDisabled();
  });

  it('collapses more than 5 teams', async function () {
    render(
      <ProjectTeamAccess
        organization={organization}
        project={ProjectFixture({
          teams: [
            Team({slug: 'team1'}),
            Team({slug: 'team2'}),
            Team({slug: 'team3'}),
            Team({slug: 'team4'}),
            Team({slug: 'team5'}),
            Team({slug: 'team6'}),
            Team({slug: 'team7'}),
          ],
        })}
      />,
      {context: routerContext}
    );

    expect(screen.getAllByTestId('badge-display-name')).toHaveLength(5);

    await userEvent.click(screen.getByRole('button', {name: 'Show 2 collapsed teams'}));
    expect(screen.getAllByTestId('badge-display-name')).toHaveLength(7);

    await userEvent.click(screen.getByRole('button', {name: 'Collapse'}));
    expect(screen.getAllByTestId('badge-display-name')).toHaveLength(5);
  });

  it('sorts teams alphabetically', function () {
    render(
      <ProjectTeamAccess
        organization={organization}
        project={ProjectFixture({
          teams: [Team({slug: 'c'}), Team({slug: 'z'}), Team({slug: 'a'})],
        })}
      />,
      {context: routerContext}
    );

    const badges = screen.getAllByTestId('badge-display-name');
    expect(badges[0]).toHaveTextContent('#a');
    expect(badges[1]).toHaveTextContent('#c');
    expect(badges[2]).toHaveTextContent('#z');
  });
});
