import {skipToken} from '@tanstack/react-query';
import {expectTypeOf} from 'expect-type';

import getApiUrl from 'sentry/utils/api/getApiUrl';

describe('getApiUrl', () => {
  it('should replace path parameters with their values', () => {
    // @ts-expect-error Using a sample path, not a real one
    const url = getApiUrl('/projects/$orgSlug/$projectSlug/', {
      path: {
        orgSlug: 'my-org',
        projectSlug: 'my-project',
      },
    });

    expect(url).toBe('/projects/my-org/my-project/');
  });

  it('should not require path parameters if none are present', () => {
    const url = getApiUrl('/api-tokens/');

    expect(url).toBe('/api-tokens/');
  });

  it('should encode path parameters correctly', () => {
    const url = getApiUrl('/organizations/$organizationIdOrSlug/releases/$version/', {
      path: {
        organizationIdOrSlug: 'my-org',
        version: 'v 1.0.0',
      },
    });

    expect(url).toBe('/organizations/my-org/releases/v%201.0.0/');
  });

  it('should return the original path, without replacements, if skipToken is provided', () => {
    const url = getApiUrl('/organizations/$organizationIdOrSlug/releases/$version/', {
      path: skipToken,
    });

    expect(url).toBe('/organizations/$organizationIdOrSlug/releases/$version/');
  });

  it('should stringify number path params', () => {
    const url = getApiUrl('/api-tokens/$tokenId/', {
      path: {tokenId: 123},
    });

    expect(url).toBe('/api-tokens/123/');
  });

  it('should not do accidental replacements', () => {
    // @ts-expect-error Using a sample path, not a real one
    const url = getApiUrl('/projects/$id1/$id', {
      path: {id: '123', id1: '456'},
    });

    expect(url).toBe('/projects/456/123');
  });

  it('should replace segments with : in the middle', () => {
    const url = getApiUrl(
      '/organizations/$organizationIdOrSlug/events/$projectIdOrSlug:$eventId/',
      {
        path: {
          organizationIdOrSlug: 'org-slug',
          projectIdOrSlug: 'abc',
          eventId: '123',
        },
      }
    );

    expect(url).toBe('/organizations/org-slug/events/abc:123/');
  });

  it('should allow string or number path parameters', () => {
    const url1 = getApiUrl('/api-tokens/$tokenId/', {
      path: {tokenId: 123},
    });

    expect(url1).toBe('/api-tokens/123/');

    const url2 = getApiUrl('/api-tokens/$tokenId/', {
      path: {tokenId: 'abc'},
    });

    expect(url2).toBe('/api-tokens/abc/');
  });

  describe('types', () => {
    it('should return branded string type', () => {
      const url = getApiUrl('/api-tokens/$tokenId/', {
        path: {tokenId: 'my-token'},
      });

      expectTypeOf(url).toEqualTypeOf<string & {__apiUrl: true}>();
    });
    it('should not allow invalid/excess path parameters', () => {
      getApiUrl('/api-tokens/$tokenId/', {
        // @ts-expect-error Missing required path parameter
        path: {tokenId: 'my-org', invalidParam: 'invalid'},
      });
    });

    it('should require path params for paths with parameters', () => {
      expect(() => {
        getApiUrl('/api-tokens/$tokenId/', {
          // @ts-expect-error Missing required path parameter
          path: {},
        });
      }).toThrow('Missing path param: tokenId');
    });

    it('should not allow empty path parameters for paths without parameters', () => {
      // @ts-expect-error Expected 1 argument, but got 2
      getApiUrl('/api-tokens/', {path: {}});
    });
  });
});
