import React from 'react';
import {mount} from 'enzyme';

import Projects from 'app/utils/projects';
import ProjectsStore from 'app/stores/projectsStore';

describe('utils.projects', function() {
  const renderer = jest.fn(() => null);

  const createWrapper = props =>
    mount(
      <Projects orgId="org-slug" {...props}>
        {renderer}
      </Projects>
    );

  beforeEach(function() {
    renderer.mockClear();
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([
      TestStubs.Project({id: '1', slug: 'foo'}),
      TestStubs.Project({id: '2', slug: 'bar'}),
    ]);
  });

  afterEach(async function() {
    ProjectsStore.loadInitialData([]);
    await tick();
  });

  describe('with predefined list of slugs', function() {
    it('gets projects that are in the ProjectsStore ', async function() {
      const wrapper = createWrapper({slugs: ['foo', 'bar']});

      // This is initial state
      expect(renderer).toHaveBeenCalledWith({
        fetching: false,
        isIncomplete: null,
        initiallyLoaded: true,
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
      });

      await tick();
      wrapper.update();

      expect(renderer).toHaveBeenCalledWith({
        fetching: false,
        isIncomplete: null,
        initiallyLoaded: true,
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
      });
    });

    it('fetches projects from API if not found in store', async function() {
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
      expect(renderer).toHaveBeenCalledWith({
        fetching: true,
        isIncomplete: null,
        initiallyLoaded: true,
        projects: [
          {slug: 'a'},
          {slug: 'b'},
          expect.objectContaining({
            id: '1',
            slug: 'foo',
          }),
        ],
      });

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

      expect(renderer).toHaveBeenCalledWith({
        fetching: false,
        isIncomplete: false,
        initiallyLoaded: true,
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
      });
    });

    it('only has partial results from API', async function() {
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
      expect(renderer).toHaveBeenCalledWith({
        fetching: true,
        isIncomplete: null,
        initiallyLoaded: true,
        projects: [
          {slug: 'a'},
          {slug: 'b'},
          expect.objectContaining({
            id: '1',
            slug: 'foo',
          }),
        ],
      });

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

      expect(renderer).toHaveBeenCalledWith({
        fetching: false,
        isIncomplete: true,
        initiallyLoaded: true,
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
      });
    });
  });
});
