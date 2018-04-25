import ProjectsStore from 'app/stores/projectsStore';
import ProjectActions from 'app/actions/projectActions';
import TeamActions from 'app/actions/teamActions';

describe('ProjectsStore', function() {
  let teamFoo = TestStubs.Team({
    slug: 'team-foo',
  });
  let teamBar = TestStubs.Team({
    slug: 'team-bar',
  });
  let projectFoo = TestStubs.Project({
    id: '2',
    slug: 'foo',
    name: 'Foo',
    teams: [teamFoo],
  });
  let projectBar = TestStubs.Project({
    id: '10',
    slug: 'bar',
    name: 'Bar',
    teams: [teamFoo, teamBar],
  });

  beforeEach(function() {
    ProjectsStore.reset();
    ProjectsStore.loadInitialData([projectFoo, projectBar]);
  });

  it('updates when slug changes', async function() {
    ProjectActions.changeSlug('foo', 'new-project');
    await tick();
    expect(ProjectsStore.itemsById[projectFoo.id]).toMatchObject({
      slug: 'new-project',
    });
    expect(ProjectsStore.itemsById[projectBar.id]).toBeDefined();
  });

  it('adds project to store on "create success"', async function() {
    let project = TestStubs.Project({id: '11', slug: 'created-project'});
    ProjectActions.createSuccess(project);
    await tick();
    expect(ProjectsStore.itemsById[project.id]).toMatchObject({
      id: '11',
      slug: 'created-project',
    });
    expect(ProjectsStore.itemsById[projectFoo.id]).toMatchObject({
      id: '2',
      slug: 'foo',
      name: 'Foo',
    });
    expect(ProjectsStore.itemsById[projectBar.id]).toMatchObject({
      id: '10',
      slug: 'bar',
    });
  });

  it('updates a project in store', async function() {
    // Create a new project, but should have same id as `projectBar`
    let project = TestStubs.Project({id: '10', slug: 'bar', name: 'New Name'});
    ProjectActions.updateSuccess(project);
    await tick();
    expect(ProjectsStore.itemsById[projectBar.id]).toMatchObject({
      id: '10',
      slug: 'bar',
      name: 'New Name',
    });
    expect(ProjectsStore.itemsById[projectFoo.id]).toMatchObject({
      id: '2',
      slug: 'foo',
      name: 'Foo',
    });
  });

  it('can remove a team from a single project', async function() {
    expect(ProjectsStore.itemsById[projectBar.id]).toMatchObject({
      teams: [
        expect.objectContaining({slug: 'team-foo'}),
        expect.objectContaining({slug: 'team-bar'}),
      ],
    });
    ProjectActions.removeTeamSuccess('team-foo', 'bar');
    await tick();

    expect(ProjectsStore.itemsById[projectBar.id]).toMatchObject({
      teams: [expect.objectContaining({slug: 'team-bar'})],
    });
    expect(ProjectsStore.itemsById[projectFoo.id]).toMatchObject({
      teams: [expect.objectContaining({slug: 'team-foo'})],
    });
  });

  it('removes a team from all projects when team is deleted', async function() {
    expect(ProjectsStore.itemsById[projectBar.id]).toMatchObject({
      teams: [
        expect.objectContaining({slug: 'team-foo'}),
        expect.objectContaining({slug: 'team-bar'}),
      ],
    });
    expect(ProjectsStore.itemsById[projectFoo.id]).toMatchObject({
      teams: [expect.objectContaining({slug: 'team-foo'})],
    });

    TeamActions.removeTeamSuccess('team-foo');
    await tick();

    expect(ProjectsStore.itemsById[projectBar.id]).toMatchObject({
      teams: [expect.objectContaining({slug: 'team-bar'})],
    });
    expect(ProjectsStore.itemsById[projectFoo.id]).toMatchObject({
      teams: [],
    });
  });

  it('can add a team to a project', async function() {
    let team = TestStubs.Team({
      slug: 'new-team',
    });
    ProjectActions.addTeamSuccess(team, 'foo');
    await tick();

    expect(ProjectsStore.itemsById[projectBar.id]).toMatchObject({
      teams: [
        expect.objectContaining({slug: 'team-foo'}),
        expect.objectContaining({slug: 'team-bar'}),
      ],
    });
    expect(ProjectsStore.itemsById[projectFoo.id]).toMatchObject({
      teams: [
        expect.objectContaining({slug: 'team-foo'}),
        expect.objectContaining({slug: 'new-team'}),
      ],
    });
  });
});
