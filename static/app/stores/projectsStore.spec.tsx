import {Project} from 'sentry-fixture/project';
import {Team} from 'sentry-fixture/team';

import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';

describe('ProjectsStore', function () {
  const teamFoo = Team({
    slug: 'team-foo',
  });
  const teamBar = Team({
    slug: 'team-bar',
  });
  const projectFoo = Project({
    id: '2',
    slug: 'foo',
    name: 'Foo',
    teams: [teamFoo],
  });
  const projectBar = Project({
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
      ProjectsStore.onChangeSlug('foo', 'new-project');
      await tick();
      expect(ProjectsStore.getById(projectFoo.id)).toMatchObject({
        slug: 'new-project',
      });
      expect(ProjectsStore.getById(projectBar.id)).toBeDefined();
    });

    it('adds project to store on "create success"', function () {
      const project = Project({id: '11', slug: 'created-project'});
      const reloadOrgRequest = MockApiClient.addMockResponse({
        url: '/organizations/my-org/',
        body: {},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/my-org/projects/',
        body: [project, projectBar, projectFoo],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/my-org/teams/',
        body: [],
      });

      ProjectsStore.onCreateSuccess(project, 'my-org');

      expect(ProjectsStore.getById(project.id)).toMatchObject({
        id: '11',
        slug: 'created-project',
      });
      expect(ProjectsStore.getById(projectFoo.id)).toMatchObject({
        id: '2',
        slug: 'foo',
        name: 'Foo',
      });
      expect(ProjectsStore.getById(projectBar.id)).toMatchObject({
        id: '10',
        slug: 'bar',
      });

      expect(reloadOrgRequest).toHaveBeenCalled();
    });

    it('updates a project in store', function () {
      // Create a new project, but should have same id as `projectBar`
      const project = Project({id: '10', slug: 'bar', name: 'New Name'});
      ProjectsStore.onUpdateSuccess(project);
      expect(ProjectsStore.getById(projectBar.id)).toMatchObject({
        id: '10',
        slug: 'bar',
        name: 'New Name',
      });
      expect(ProjectsStore.getById(projectFoo.id)).toMatchObject({
        id: '2',
        slug: 'foo',
        name: 'Foo',
      });
    });

    it('can remove a team from a single project', function () {
      expect(ProjectsStore.getById(projectBar.id)).toMatchObject({
        teams: [
          expect.objectContaining({slug: 'team-foo'}),
          expect.objectContaining({slug: 'team-bar'}),
        ],
      });
      ProjectsStore.onRemoveTeam('team-foo', 'bar');

      expect(ProjectsStore.getById(projectBar.id)).toMatchObject({
        teams: [expect.objectContaining({slug: 'team-bar'})],
      });
      expect(ProjectsStore.getById(projectFoo.id)).toMatchObject({
        teams: [expect.objectContaining({slug: 'team-foo'})],
      });
    });

    it('removes a team from all projects when team is deleted', function () {
      expect(ProjectsStore.getById(projectBar.id)).toMatchObject({
        teams: [
          expect.objectContaining({slug: 'team-foo'}),
          expect.objectContaining({slug: 'team-bar'}),
        ],
      });
      expect(ProjectsStore.getById(projectFoo.id)).toMatchObject({
        teams: [expect.objectContaining({slug: 'team-foo'})],
      });

      TeamStore.onRemoveSuccess('team-foo');

      expect(ProjectsStore.getById(projectBar.id)).toMatchObject({
        teams: [expect.objectContaining({slug: 'team-bar'})],
      });
      expect(ProjectsStore.getById(projectFoo.id)).toMatchObject({
        teams: [],
      });
    });

    it('can add a team to a project', function () {
      const team = Team({
        slug: 'new-team',
      });
      ProjectsStore.onAddTeam(team, 'foo');

      expect(ProjectsStore.getById(projectBar.id)).toMatchObject({
        teams: [
          expect.objectContaining({slug: 'team-foo'}),
          expect.objectContaining({slug: 'team-bar'}),
        ],
      });
      expect(ProjectsStore.getById(projectFoo.id)).toMatchObject({
        teams: [
          expect.objectContaining({slug: 'team-foo'}),
          expect.objectContaining({slug: 'new-team'}),
        ],
      });
    });
  });
});
