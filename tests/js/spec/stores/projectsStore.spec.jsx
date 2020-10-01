import ProjectsStore from 'app/stores/projectsStore';
import ProjectActions from 'app/actions/projectActions';
import TeamActions from 'app/actions/teamActions';

describe('ProjectsStore', function () {
  const teamFoo = TestStubs.Team({
    slug: 'team-foo',
  });
  const teamBar = TestStubs.Team({
    slug: 'team-bar',
  });
  const projectFoo = TestStubs.Project({
    id: '2',
    slug: 'foo',
    name: 'Foo',
    teams: [teamFoo],
  });
  const projectBar = TestStubs.Project({
    id: '10',
    slug: 'bar',
    name: 'Bar',
    teams: [teamFoo, teamBar],
  });

  describe('setting data', function () {
    beforeEach(function () {
      ProjectsStore.reset();
    });

    it('correctly manages loading state', function () {
      expect(ProjectsStore.getState()).toMatchObject({
        projects: [],
        loading: true,
      });
      ProjectsStore.loadInitialData([projectFoo, projectBar]);
      expect(ProjectsStore.getState()).toMatchObject({
        projects: [projectBar, projectFoo], // projects are returned sorted
        loading: false,
      });
    });
  });

  describe('updating data', function () {
    beforeEach(function () {
      ProjectsStore.reset();
      ProjectsStore.loadInitialData([projectFoo, projectBar]);
    });

    it('updates when slug changes', async function () {
      ProjectActions.changeSlug('foo', 'new-project');
      await tick();
      expect(ProjectsStore.itemsById[projectFoo.id]).toMatchObject({
        slug: 'new-project',
      });
      expect(ProjectsStore.itemsById[projectBar.id]).toBeDefined();
    });

    it('adds project to store on "create success"', async function () {
      const project = TestStubs.Project({id: '11', slug: 'created-project'});
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

    it('updates a project in store', async function () {
      // Create a new project, but should have same id as `projectBar`
      const project = TestStubs.Project({id: '10', slug: 'bar', name: 'New Name'});
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

    it('can remove a team from a single project', async function () {
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

    it('removes a team from all projects when team is deleted', async function () {
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

    it('can add a team to a project', async function () {
      const team = TestStubs.Team({
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
});
