import {partialMatchKey} from '@tanstack/react-query';
import {expectTypeOf} from 'expect-type';
import {OrganizationFixture} from 'sentry-fixture/organization';

import type {Detector, UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {
  detectorListApiOptions,
  allDetectorListsQueryKey,
} from 'sentry/views/detectors/hooks';

const organization = OrganizationFixture();

describe('detectorListApiOptions', () => {
  describe('query construction', () => {
    it('excludes issue_stream detectors by default', () => {
      const {options} = detectorListApiOptions(organization).queryKey[1];
      expect(options?.query?.query).toBe('!type:issue_stream');
    });

    it('does not exclude issue_stream when includeIssueStreamDetectors is true', () => {
      const {options} = detectorListApiOptions(organization, {
        includeIssueStreamDetectors: true,
      }).queryKey[1];
      expect(options?.query?.query).toBeUndefined();
    });

    it('adds type filter when type is provided', () => {
      const {options} = detectorListApiOptions(organization, {type: 'uptime'})
        .queryKey[1];
      expect(options?.query?.query).toBe('!type:issue_stream type:uptime');
    });

    it('combines type filter with custom query', () => {
      const {options} = detectorListApiOptions(organization, {
        type: 'uptime',
        query: 'my-search',
      }).queryKey[1];
      expect(options?.query?.query).toBe('!type:issue_stream type:uptime my-search');
    });

    it('combines includeIssueStreamDetectors with type', () => {
      const {options} = detectorListApiOptions(organization, {
        type: 'uptime',
        includeIssueStreamDetectors: true,
      }).queryKey[1];
      expect(options?.query?.query).toBe('type:uptime');
    });

    it('passes through pagination and filter params', () => {
      const {options} = detectorListApiOptions(organization, {
        cursor: 'abc123',
        limit: 25,
        sortBy: 'name',
        projects: [1, 2],
        ids: ['10', '20'],
      }).queryKey[1];
      expect(options?.query).toEqual(
        expect.objectContaining({
          cursor: 'abc123',
          per_page: 25,
          sortBy: 'name',
          project: [1, 2],
          id: ['10', '20'],
        })
      );
    });

    it('builds the correct URL', () => {
      const {fullUrl: url} = detectorListApiOptions(organization).queryKey[1];
      expect(url).toBe(`/organizations/${organization.slug}/detectors/`);
    });
  });

  describe('types', () => {
    it('returns Detector[] by default', () => {
      const options = detectorListApiOptions(organization);
      expectTypeOf(options.select).returns.toEqualTypeOf<Detector[]>();
    });

    it('returns UptimeDetector[] when type is uptime', () => {
      const options = detectorListApiOptions(organization, {type: 'uptime'});
      expectTypeOf(options.select).returns.toEqualTypeOf<UptimeDetector[]>();
    });

    it('returns Detector[] when no type is provided with other params', () => {
      const options = detectorListApiOptions(organization, {cursor: 'abc'});
      expectTypeOf(options.select).returns.toEqualTypeOf<Detector[]>();
    });

    it('returns ApiResponse<UptimeDetector[]> when selectJsonWithHeaders is used', () => {
      const options = detectorListApiOptions(organization, {type: 'uptime'});
      // The select override changes the type, but the queryFn data type is correct
      expectTypeOf(options.select)
        .parameter(0)
        .toEqualTypeOf<ApiResponse<UptimeDetector[]>>();
    });
  });

  describe('allDetectorListsQueryKey', () => {
    it('produces a prefix key that matches all detector list queries', () => {
      const prefixKey = allDetectorListsQueryKey(organization);

      // Only path params in options, so it partially matches every filter
      expect(prefixKey).toEqual([
        '_api',
        {
          fullUrl: `/organizations/${organization.slug}/detectors/`,
          urlParts: ['organizations', '$organizationIdOrSlug', 'detectors'],
          options: {path: {organizationIdOrSlug: organization.slug}},
        },
      ]);
    });

    it('prefix-matches queries with different filters', () => {
      const prefixKey = allDetectorListsQueryKey(organization);
      const uptimeKey = detectorListApiOptions(organization, {
        type: 'uptime',
      }).queryKey;
      const defaultKey = detectorListApiOptions(organization).queryKey;

      // The prefix should match both
      expect(partialMatchKey(uptimeKey, prefixKey)).toBe(true);
      expect(partialMatchKey(defaultKey, prefixKey)).toBe(true);
    });
  });
});
