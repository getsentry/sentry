import React from 'react';

import {mount} from 'sentry-test/enzyme';

import Projects from 'app/utils/projects';
import ProjectsStore from 'app/stores/projectsStore';
import ProjectActions from 'app/actions/projectActions';

describe('utils.projects', function () {
  const renderer = jest.fn(() => null);

  const createWrapper = props =>
    mount(<Projects orgId="org-slug" children={renderer} {...props} />); // eslint-disable-line

  beforeEach(function () {
    renderer.mockClear();
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([
      TestStubs.Project({id: '1', slug: 'foo'}),
      TestStubs.Project({id: '2', slug: 'bar'}),
    ]);
  });

  afterEach(async function () {
    ProjectsStore.loadInitialData([]);
    await tick();
  });

  describe('with predefined list of slugs', function () {
    it('gets projects that are in the ProjectsStore ', async function () {
      const wrapper = createWrapper({slugs: ['foo', 'bar']});

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

      await tick();
      wrapper.update();

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

      const wrapper = createWrapper({slugs: ['foo', 'a', 'b']});

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

      await tick();
      wrapper.update();

      expect(request).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: {
            query: 'slug:a slug:b',
          },
        })
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

      const wrapper = createWrapper({slugs: ['foo', 'a', 'b']});

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

      await tick();
      wrapper.update();

      expect(request).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: {
            query: 'slug:a slug:b',
          },
        })
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
      ProjectsStore.loadInitialData([]);
      await tick();
    });

    it('fetches projects from API', async function () {
      const wrapper = createWrapper();

      // This is initial state
      expect(renderer).toHaveBeenCalledWith(
        expect.objectContaining({
          fetching: true,
          isIncomplete: null,
          hasMore: null,
          projects: [],
        })
      );

      await tick();
      wrapper.update();

      expect(request).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: {},
        })
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

      const wrapper = createWrapper({children: myRenderer});

      // This is initial state
      expect(myRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          fetching: true,
          isIncomplete: null,
          hasMore: null,
          projects: [],
        })
      );

      await tick();
      wrapper.update();

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

      wrapper.find('input').simulate('change', {target: {value: 'test'}});
      expect(request).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: {
            query: 'test',
          },
        })
      );

      await tick();
      wrapper.update();

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
      );
    });

    it('queries API for more projects and appends results', async function () {
      const myRenderer = jest.fn(({onSearch}) => (
        <input onChange={({target}) => onSearch(target.value, {append: true})} />
      ));

      const wrapper = createWrapper({children: myRenderer});

      await tick();
      wrapper.update();

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

      wrapper.find('input').simulate('change', {target: {value: 'test'}});
      expect(request).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: {
            query: 'test',
          },
        })
      );

      await tick();
      wrapper.update();

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
      );

      // Should not have duplicates
      wrapper.find('input').simulate('change', {target: {value: 'test'}});

      await tick();
      wrapper.update();

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
        },
        body: mockProjects,
      });
      loadProjects.mockReset();
      ProjectsStore.reset();
    });

    it('can query for a list of all projects and save it to the store', async function () {
      const wrapper = createWrapper({allProjects: true});
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
      await tick();
      wrapper.update();
      expect(request).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: {all_projects: 1},
        })
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
      ProjectsStore.loadInitialData(mockProjects);

      const wrapper = createWrapper({allProjects: true});
      wrapper.update();

      expect(renderer).toHaveBeenCalledWith(
        expect.objectContaining({
          fetching: false,
          isIncomplete: null,
          hasMore: false,
          projects: mockProjects,
        })
      );
      expect(request).not.toHaveBeenCalled();
      expect(loadProjects).not.toHaveBeenCalled();
    });
  });
});
