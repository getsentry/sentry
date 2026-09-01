import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {
  getBulkDeleteErrorReason,
  useDeleteReplays,
} from 'sentry/utils/replays/hooks/useDeleteReplays';
import {RequestError} from 'sentry/utils/requestError/requestError';

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

  describe('hasAccess', () => {
    const project = ProjectFixture({access: []});
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

    it('should grant access to users with project:write', () => {
      const organization = OrganizationFixture({access: ['project:write']});

      const {result} = renderHookWithProviders(useDeleteReplays, {
        initialProps: {projectSlug},
        organization,
      });

      expect(result.current.hasAccess).toBe(true);
    });

    it('should grant access to users with project:admin', () => {
      const organization = OrganizationFixture({access: ['project:admin']});

      const {result} = renderHookWithProviders(useDeleteReplays, {
        initialProps: {projectSlug},
        organization,
      });

      expect(result.current.hasAccess).toBe(true);
    });

    it('should grant access to org owners with org:admin', () => {
      const organization = OrganizationFixture({access: ['org:admin']});

      const {result} = renderHookWithProviders(useDeleteReplays, {
        initialProps: {projectSlug},
        organization,
      });

      expect(result.current.hasAccess).toBe(true);
    });

    it('should deny access to users without proper permissions', () => {
      const organization = OrganizationFixture({access: ['org:read']});

      const {result} = renderHookWithProviders(useDeleteReplays, {
        initialProps: {projectSlug},
        organization,
      });

      expect(result.current.hasAccess).toBe(false);
    });

    it('should deny access when projectSlug is empty', () => {
      const organization = OrganizationFixture({access: ['org:admin']});

      const {result} = renderHookWithProviders(useDeleteReplays, {
        initialProps: {projectSlug: ''},
        organization,
      });

      expect(result.current.hasAccess).toBe(false);
    });
  });
  describe('getBulkDeleteErrorReason', () => {
    function makeRequestError(responseJSON: Record<string, unknown>) {
      return new RequestError('POST', '/delete/', new Error('Bad Request'), {
        getResponseHeader: () => null,
        responseJSON,
        responseText: JSON.stringify(responseJSON),
        status: 400,
        statusText: 'Bad Request',
      });
    }

    it('should return the range limit message when the payload exceeds 30 days', () => {
      const error = makeRequestError({
        data: {
          non_field_errors: ['you cannot delete more than 30 days of data at a time'],
        },
      });

      expect(getBulkDeleteErrorReason(error)).toBe(
        'you cannot delete more than 30 days of data at a time'
      );
    });

    it('should name the field when a single field fails validation', () => {
      const error = makeRequestError({
        data: {environments: ['This field is required.']},
      });

      expect(getBulkDeleteErrorReason(error)).toBe(
        'environments — This field is required.'
      );
    });

    it('should name each field when multiple fields fail validation', () => {
      const error = makeRequestError({
        data: {
          environments: ['This field is required.'],
          rangeStart: ['Enter a valid date/time.'],
        },
      });

      expect(getBulkDeleteErrorReason(error)).toBe(
        'environments — This field is required. rangeStart — Enter a valid date/time.'
      );
    });

    it('should return the detail string when the response has a detail', () => {
      const error = makeRequestError({detail: 'You do not have permission.'});

      expect(getBulkDeleteErrorReason(error)).toBe('You do not have permission.');
    });

    it('should return the detail message when detail is an object', () => {
      const error = makeRequestError({
        detail: {code: 'sudo-required', message: 'Account verification required.'},
      });

      expect(getBulkDeleteErrorReason(error)).toBe('Account verification required.');
    });

    it('should return undefined when the response has no readable message', () => {
      const error = makeRequestError({});

      expect(getBulkDeleteErrorReason(error)).toBeUndefined();
    });

    it('should return undefined when the error is not a request error', () => {
      expect(getBulkDeleteErrorReason(new Error('boom'))).toBeUndefined();
    });
  });
});
