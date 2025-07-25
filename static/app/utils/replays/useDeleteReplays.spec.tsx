import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import useDeleteReplays from 'sentry/utils/replays/hooks/useDeleteReplays';
import {OrganizationContext} from 'sentry/views/organizationContext';

function wrapper({children}: {children?: ReactNode}) {
  const org = OrganizationFixture();
  return (
    <QueryClientProvider client={makeTestQueryClient()}>
      <OrganizationContext value={org}>{children}</OrganizationContext>
    </QueryClientProvider>
  );
}

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

    it('should parse a statsPeriod into rangeStart & rangeEnd', () => {
      const {result} = renderHook(useDeleteReplays, {
        wrapper,
        initialProps: {projectSlug},
      });

      expect(
        result.current.queryOptionsToPayload(['1', '2'], {
          query: {
            statsPeriod: '1d',
          },
        })
      ).toEqual({
        rangeStart: '2017-10-16T02:41:20.000Z',
        rangeEnd: '2017-10-17T02:41:20.000Z',
        environments: [],
        query: 'id:[1,2]',
      });
    });

    it('should parse a start & end into rangeStart & rangeEnd', () => {
      const {result} = renderHook(useDeleteReplays, {
        wrapper,
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
