import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectTeamAccess from 'sentry/views/projectDetail/projectTeamAccess';

describe('ProjectDetail > ProjectTeamAccess', function () {
  const {organization, router} = initializeOrg();

  it('renders a list', function () {
    render(
      <ProjectTeamAccess
        organization={organization}
        project={ProjectFixture({teams: [TeamFixture()]})}
      />,
      {router}
    );

    expect(screen.getByText('Team Access')).toBeInTheDocument();
    expect(screen.getByText('#team-slug')).toBeInTheDocument();
  });

  it('links to a team settings', function () {
    render(
      <ProjectTeamAccess
        organization={organization}
        project={ProjectFixture({teams: [TeamFixture()]})}
      />,
      {router}
    );

    expect(screen.getByRole('link', {name: '#team-slug'})).toHaveAttribute(
      'href',
      '/settings/org-slug/teams/team-slug/'
    );
  });

  it('display the right empty state with access', function () {
    render(<ProjectTeamAccess organization={organization} project={ProjectFixture()} />, {
      router,
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
      {router}
    );
    expect(screen.getByRole('button', {name: 'Assign Team'})).toBeDisabled();
  });

  it('collapses more than 5 teams', async function () {
    render(
      <ProjectTeamAccess
        organization={organization}
        project={ProjectFixture({
          teams: [
            TeamFixture({slug: 'team1'}),
            TeamFixture({slug: 'team2'}),
            TeamFixture({slug: 'team3'}),
            TeamFixture({slug: 'team4'}),
            TeamFixture({slug: 'team5'}),
            TeamFixture({slug: 'team6'}),
            TeamFixture({slug: 'team7'}),
          ],
        })}
      />,
      {router}
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
          teams: [
            TeamFixture({slug: 'c'}),
            TeamFixture({slug: 'z'}),
            TeamFixture({slug: 'a'}),
          ],
        })}
      />,
      {router}
    );

    const badges = screen.getAllByTestId('badge-display-name');
    expect(badges[0]).toHaveTextContent('#a');
    expect(badges[1]).toHaveTextContent('#c');
    expect(badges[2]).toHaveTextContent('#z');
  });
});
