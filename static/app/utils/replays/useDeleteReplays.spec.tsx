import {ProjectFixture} from 'sentry-fixture/project';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import useDeleteReplays from 'sentry/utils/replays/hooks/useDeleteReplays';

describe('useDeleteReplays', () => {
  describe('queryOptionsToPayload', () => {
    const project = ProjectFixture();
    const projectSlug = project.slug;

    beforeEach(() => {
      const configstate = ConfigStore.getState();
      ConfigStore.loadInitialData({
        ...configstate,
        user: {
          ...configstate.user,
          options: {
            ...configstate.user?.options,
            timezone: 'America/New_York',
          },
        },
      });

      ProjectsStore.loadInitialData([project]);
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [project],
      });
    });

    it('should parse a an empty queryOptions into default 14d rangeStart & rangeEnd', () => {
      const {result} = renderHookWithProviders(useDeleteReplays, {
        initialProps: {projectSlug},
      });

      expect(result.current.queryOptionsToPayload(['1', '2'], {})).toEqual({
        rangeStart: '2017-10-03T02:41:20.000Z',
        rangeEnd: '2017-10-17T02:41:20.000Z',
        environments: [],
        query: 'id:[1,2]',
      });
    });

    it('should parse a statsPeriod into rangeStart & rangeEnd', () => {
      const {result} = renderHookWithProviders(useDeleteReplays, {
        initialProps: {projectSlug},
      });

      expect(
        result.current.queryOptionsToPayload(['1', '2'], {
          query: {statsPeriod: '1d'},
        })
      ).toEqual({
        rangeStart: '2017-10-16T02:41:20.000Z',
        rangeEnd: '2017-10-17T02:41:20.000Z',
        environments: [],
        query: 'id:[1,2]',
      });
    });

    it('should parse a start & end into rangeStart & rangeEnd', () => {
      const {result} = renderHookWithProviders(useDeleteReplays, {
        initialProps: {projectSlug},
      });

      // Users timezone: 2:41 becomes 6:41 UTC
      expect(
        result.current.queryOptionsToPayload(['1', '2'], {
          query: {
            start: '2017-10-16T02:41:20',
            end: '2017-10-17T02:41:20',
          },
        })
      ).toEqual({
        rangeStart: '2017-10-16T06:41:20.000Z',
        rangeEnd: '2017-10-17T06:41:20.000Z',
        environments: [],
        query: 'id:[1,2]',
      });

      // UTC: 2:41 stays 2:41 UTC
      expect(
        result.current.queryOptionsToPayload(['1', '2'], {
          query: {
            start: '2017-10-16T02:41:20',
            end: '2017-10-17T02:41:20',
            utc: 'true',
          },
        })
      ).toEqual({
        rangeStart: '2017-10-16T02:41:20.000Z',
        rangeEnd: '2017-10-17T02:41:20.000Z',
        environments: [],
        query: 'id:[1,2]',
      });
    });
  });
});
