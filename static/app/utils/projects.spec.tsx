import {Project as ProjectFixture} from 'sentry-fixture/project';
import {Team} from 'sentry-fixture/team';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import Projects from 'sentry/utils/projects';

describe('utils.projects', function () {
  const renderer = jest.fn(() => null);

  const createWrapper = (props = {}) =>
    render(<Projects orgId="org-slug" children={renderer} {...props} />); // eslint-disable-line

  beforeEach(function () {
    renderer.mockClear();
    MockApiClient.clearMockResponses();
    act(() =>
      ProjectsStore.loadInitialData([
        ProjectFixture({id: '1', slug: 'foo'}),
        ProjectFixture({id: '2', slug: 'bar'}),
      ])
    );
  });

  afterEach(async function () {
    act(() => ProjectsStore.loadInitialData([]));
    await tick();
  });

  describe('with predefined list of slugs', function () {
    it('gets projects that are in the ProjectsStore', function () {
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
        body: [
          ProjectFixture({
            id: '100',
            slug: 'a',
          }),
          ProjectFixture({
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
          ProjectFixture({
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

      const newTeam = Team();
      act(() => ProjectsStore.onAddTeam(newTeam, 'foo'));

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

  describe('with predefined list of project ids', function () {
    it('gets project ids that are in the ProjectsStore', function () {
      createWrapper({projectIds: [1, 2]});

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

    it('fetches projects from API if ids not found in store', async function () {
      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [
          ProjectFixture({
            id: '1',
            slug: 'foo',
          }),
          ProjectFixture({
            id: '100',
            slug: 'a',
          }),
          ProjectFixture({
            id: '101',
            slug: 'b',
          }),
        ],
      });

      createWrapper({projectIds: [1, 100, 101]});

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
          hasMore: false,
          projects: [
            expect.objectContaining({
              id: '1',
              slug: 'foo',
            }),
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
  });

  describe('with no pre-defined projects', function () {
    let request;

    beforeEach(async function () {
      request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [
          ProjectFixture({
            id: '100',
            slug: 'a',
          }),
          ProjectFixture({
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
          ProjectFixture({
            id: '102',
            slug: 'test1',
          }),
          ProjectFixture({
            id: '103',
            slug: 'test2',
          }),
        ],
      });

      await userEvent.type(screen.getByRole('textbox'), 'test');

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
          ProjectFixture({
            id: '102',
            slug: 'test1',
          }),
          ProjectFixture({
            id: '103',
            slug: 'test2',
          }),
        ],
      });

      await userEvent.type(screen.getByRole('textbox'), 'test');

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
      await userEvent.type(screen.getByRole('textbox'), 'test');

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
    let mockProjects;
    let request;

    beforeEach(function () {
      mockProjects = [
        ProjectFixture({
          id: '100',
          slug: 'a',
        }),
        ProjectFixture({
          id: '101',
          slug: 'b',
        }),
        ProjectFixture({
          id: '102',
          slug: 'c',
        }),
      ];

      request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: mockProjects,
      });
      ProjectsStore.reset();
    });

    it('can query for a list of all projects and save it to the store', async function () {
      const loadInitialData = jest.spyOn(ProjectsStore, 'loadInitialData');
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
      expect(loadInitialData).toHaveBeenCalledWith(mockProjects);
      loadInitialData.mockRestore();
    });

    it('does not refetch projects that are already loaded in the store', async function () {
      act(() => ProjectsStore.loadInitialData(mockProjects));
      const loadInitialData = jest.spyOn(ProjectsStore, 'loadInitialData');

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
      expect(loadInitialData).not.toHaveBeenCalled();

      loadInitialData.mockRestore();
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

      const newTeam = Team();
      act(() => ProjectsStore.onAddTeam(newTeam, 'a'));

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
