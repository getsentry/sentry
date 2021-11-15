import {
  act,
  mountWithTheme,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import ProjectActions from 'app/actions/projectActions';
import ProjectsStore from 'app/stores/projectsStore';
import Projects from 'app/utils/projects';

describe('utils.projects', function () {
  const renderer = jest.fn(() => null);

  const createWrapper = props =>
    mountWithTheme(<Projects orgId="org-slug" children={renderer} {...props} />); // eslint-disable-line

  beforeEach(function () {
    renderer.mockClear();
    MockApiClient.clearMockResponses();
    act(() =>
      ProjectsStore.loadInitialData([
        TestStubs.Project({id: '1', slug: 'foo'}),
        TestStubs.Project({id: '2', slug: 'bar'}),
      ])
    );
  });

  afterEach(async function () {
    act(() => ProjectsStore.loadInitialData([]));
    await tick();
  });

  describe('with predefined list of slugs', function () {
    it('gets projects that are in the ProjectsStore', async function () {
      createWrapper({slugs: ['foo', 'bar']});

      // This is initial state
      expect(renderer).toHaveBeenCalledWith(
        expect.objectContaining({
          fetching: false,
          isIncomplete: null,
          hasMore: null,
          projects: [
            expect.objectContaining({
              id: '1',
              slug: 'foo',
            }),
            expect.objectContaining({
              id: '2',
              slug: 'bar',
            }),
          ],
        })
      );
    });

    it('fetches projects from API if not found in store', async function () {
      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        query: {
          query: 'slug:a slug:b',
        },
        body: [
          TestStubs.Project({
            id: '100',
            slug: 'a',
          }),
          TestStubs.Project({
            id: '101',
            slug: 'b',
          }),
        ],
      });

      createWrapper({slugs: ['foo', 'a', 'b']});

      // This is initial state
      expect(renderer).toHaveBeenCalledWith(
        expect.objectContaining({
          fetching: true,
          isIncomplete: null,
          hasMore: null,
          projects: [
            {slug: 'a'},
            {slug: 'b'},
            expect.objectContaining({
              id: '1',
              slug: 'foo',
            }),
          ],
        })
      );

      await waitFor(() =>
        expect(request).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              query: 'slug:a slug:b',
              collapse: ['latestDeploys'],
            },
          })
        )
      );

      expect(renderer).toHaveBeenCalledWith(
        expect.objectContaining({
          fetching: false,
          isIncomplete: false,
          hasMore: null,
          projects: [
            expect.objectContaining({
              id: '100',
              slug: 'a',
            }),
            expect.objectContaining({
              id: '101',
              slug: 'b',
            }),
            expect.objectContaining({
              id: '1',
              slug: 'foo',
            }),
          ],
        })
      );
    });

    it('only has partial results from API', async function () {
      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [
          TestStubs.Project({
            id: '100',
            slug: 'a',
          }),
        ],
      });

      createWrapper({slugs: ['foo', 'a', 'b']});

      // This is initial state
      expect(renderer).toHaveBeenCalledWith(
        expect.objectContaining({
          fetching: true,
          isIncomplete: null,
          hasMore: null,
          projects: [
            {slug: 'a'},
            {slug: 'b'},
            expect.objectContaining({
              id: '1',
              slug: 'foo',
            }),
          ],
        })
      );

      await waitFor(() =>
        expect(request).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              query: 'slug:a slug:b',
              collapse: ['latestDeploys'],
            },
          })
        )
      );

      expect(renderer).toHaveBeenCalledWith(
        expect.objectContaining({
          fetching: false,
          isIncomplete: true,
          hasMore: null,
          projects: [
            expect.objectContaining({
              id: '100',
              slug: 'a',
            }),
            {
              slug: 'b',
            },
            expect.objectContaining({
              id: '1',
              slug: 'foo',
            }),
          ],
        })
      );
    });

    it('responds to updated projects from the project store', async function () {
      createWrapper({slugs: ['foo', 'bar']});

      await waitFor(() =>
        expect(renderer).toHaveBeenCalledWith(
          expect.objectContaining({
            fetching: false,
            isIncomplete: null,
            hasMore: null,
            projects: [
              expect.objectContaining({
                id: '1',
                slug: 'foo',
              }),
              expect.objectContaining({
                id: '2',
                slug: 'bar',
              }),
            ],
          })
        )
      );

      const newTeam = TestStubs.Team();
      act(() => ProjectActions.addTeamSuccess(newTeam, 'foo'));

      await waitFor(() =>
        expect(renderer).toHaveBeenCalledWith(
          expect.objectContaining({
            fetching: false,
            isIncomplete: null,
            hasMore: null,
            projects: [
              expect.objectContaining({
                id: '1',
                slug: 'foo',
                teams: [newTeam],
              }),
              expect.objectContaining({
                id: '2',
                slug: 'bar',
              }),
            ],
          })
        )
      );
    });
  });

  describe('with no pre-defined projects', function () {
    let request;

    beforeEach(async function () {
      request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [
          TestStubs.Project({
            id: '100',
            slug: 'a',
          }),
          TestStubs.Project({
            id: '101',
            slug: 'b',
          }),
        ],
        headers: {
          Link:
            '<http://127.0.0.1:8000/api/0/organizations/org-slug/projects/?cursor=1443575731:0:1>; rel="previous"; results="true"; cursor="1443575731:0:1", ' +
            '<http://127.0.0.1:8000/api/0/organizations/org-slug/projects/?cursor=1443575731:0:0>; rel="next"; results="true"; cursor="1443575731:0:0',
        },
      });
      act(() => ProjectsStore.loadInitialData([]));
      await tick();
    });

    it('fetches projects from API', async function () {
      createWrapper();

      // This is initial state
      expect(renderer).toHaveBeenCalledWith(
        expect.objectContaining({
          fetching: true,
          isIncomplete: null,
          hasMore: null,
          projects: [],
        })
      );

      await waitFor(() =>
        expect(request).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              collapse: ['latestDeploys'],
            },
          })
        )
      );

      expect(renderer).toHaveBeenCalledWith(
        expect.objectContaining({
          fetching: false,
          isIncomplete: null,
          hasMore: true,
          projects: [
            expect.objectContaining({
              id: '100',
              slug: 'a',
            }),
            expect.objectContaining({
              id: '101',
              slug: 'b',
            }),
          ],
        })
      );
    });

    it('queries API for more projects and replaces results', async function () {
      const myRenderer = jest.fn(({onSearch}) => (
        <input onChange={({target}) => onSearch(target.value)} />
      ));

      createWrapper({children: myRenderer});

      // This is initial state
      expect(myRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          fetching: true,
          isIncomplete: null,
          hasMore: null,
          projects: [],
        })
      );

      request.mockClear();
      request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [
          TestStubs.Project({
            id: '102',
            slug: 'test1',
          }),
          TestStubs.Project({
            id: '103',
            slug: 'test2',
          }),
        ],
      });

      userEvent.type(screen.getByRole('textbox'), 'test');

      expect(request).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: {
            query: 'test',
            collapse: ['latestDeploys'],
          },
        })
      );

      await waitFor(() =>
        expect(myRenderer).toHaveBeenLastCalledWith(
          expect.objectContaining({
            fetching: false,
            isIncomplete: null,
            hasMore: false,
            projects: [
              expect.objectContaining({
                id: '102',
                slug: 'test1',
              }),
              expect.objectContaining({
                id: '103',
                slug: 'test2',
              }),
            ],
          })
        )
      );
    });

    it('queries API for more projects and appends results', async function () {
      const myRenderer = jest.fn(({onSearch}) => (
        <input onChange={({target}) => onSearch(target.value, {append: true})} />
      ));

      createWrapper({children: myRenderer});

      request.mockClear();
      request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [
          TestStubs.Project({
            id: '102',
            slug: 'test1',
          }),
          TestStubs.Project({
            id: '103',
            slug: 'test2',
          }),
        ],
      });

      userEvent.type(screen.getByRole('textbox'), 'test');

      expect(request).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: {
            query: 'test',
            collapse: ['latestDeploys'],
          },
        })
      );

      await waitFor(() =>
        expect(myRenderer).toHaveBeenLastCalledWith(
          expect.objectContaining({
            fetching: false,
            isIncomplete: null,
            hasMore: false,
            projects: [
              expect.objectContaining({
                id: '100',
                slug: 'a',
              }),
              expect.objectContaining({
                id: '101',
                slug: 'b',
              }),
              expect.objectContaining({
                id: '102',
                slug: 'test1',
              }),
              expect.objectContaining({
                id: '103',
                slug: 'test2',
              }),
            ],
          })
        )
      );

      // Should not have duplicates
      userEvent.type(screen.getByRole('textbox'), 'test');

      await waitFor(() =>
        expect(myRenderer).toHaveBeenLastCalledWith(
          expect.objectContaining({
            projects: [
              expect.objectContaining({
                id: '100',
                slug: 'a',
              }),
              expect.objectContaining({
                id: '101',
                slug: 'b',
              }),
              expect.objectContaining({
                id: '102',
                slug: 'test1',
              }),
              expect.objectContaining({
                id: '103',
                slug: 'test2',
              }),
            ],
          })
        )
      );
    });
  });

  describe('with all projects prop', function () {
    const loadProjects = jest.spyOn(ProjectActions, 'loadProjects');
    let mockProjects;
    let request;

    beforeEach(async function () {
      mockProjects = [
        TestStubs.Project({
          id: '100',
          slug: 'a',
        }),
        TestStubs.Project({
          id: '101',
          slug: 'b',
        }),
        TestStubs.Project({
          id: '102',
          slug: 'c',
        }),
      ];

      request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        query: {
          all_projects: '1',
          collapse: ['latestDeploys'],
        },
        body: mockProjects,
      });
      loadProjects.mockReset();
      act(() => ProjectsStore.reset());
    });

    it('can query for a list of all projects and save it to the store', async function () {
      createWrapper({allProjects: true});

      // This is initial state
      expect(renderer).toHaveBeenCalledWith(
        expect.objectContaining({
          fetching: true,
          isIncomplete: null,
          hasMore: null,
          projects: [],
        })
      );

      // wait for request to resolve
      await waitFor(() =>
        expect(request).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {all_projects: 1, collapse: ['latestDeploys']},
          })
        )
      );

      expect(renderer).toHaveBeenCalledWith(
        expect.objectContaining({
          fetching: false,
          isIncomplete: null,
          hasMore: false,
          projects: mockProjects,
        })
      );

      // expect the store action to be called
      expect(loadProjects).toHaveBeenCalledWith(mockProjects);
    });

    it('does not refetch projects that are already loaded in the store', async function () {
      act(() => ProjectsStore.loadInitialData(mockProjects));

      createWrapper({allProjects: true});

      await waitFor(() =>
        expect(renderer).toHaveBeenCalledWith(
          expect.objectContaining({
            fetching: false,
            isIncomplete: null,
            hasMore: false,
            projects: mockProjects,
          })
        )
      );

      expect(request).not.toHaveBeenCalled();
      expect(loadProjects).not.toHaveBeenCalled();
    });

    it('responds to updated projects from the project store', async function () {
      act(() => ProjectsStore.loadInitialData(mockProjects));
      createWrapper({allProjects: true});

      await waitFor(() =>
        expect(renderer).toHaveBeenCalledWith(
          expect.objectContaining({
            fetching: false,
            isIncomplete: null,
            hasMore: false,
            projects: mockProjects,
          })
        )
      );

      const newTeam = TestStubs.Team();
      act(() => ProjectActions.addTeamSuccess(newTeam, 'a'));

      // Expect new team information to be available
      await waitFor(() =>
        expect(renderer).toHaveBeenCalledWith(
          expect.objectContaining({
            fetching: false,
            isIncomplete: null,
            hasMore: false,
            projects: [
              expect.objectContaining({
                id: '100',
                slug: 'a',
                teams: [newTeam],
              }),
              expect.objectContaining({
                id: '101',
                slug: 'b',
              }),
              expect.objectContaining({
                id: '102',
                slug: 'c',
              }),
            ],
          })
        )
      );
    });
  });
});
