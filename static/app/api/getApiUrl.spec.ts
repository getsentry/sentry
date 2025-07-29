import {expectTypeOf} from 'expect-type';

import {getApiUrl} from './getApiUrl';

describe('getApiUrl', () => {
  test('should replace path parameters with their values', () => {
    const url = getApiUrl('/projects/$orgSlug/$projectSlug/', {
      path: {
        orgSlug: 'my-org',
        projectSlug: 'my-project',
      },
    });

    expect(url).toBe('/projects/my-org/my-project/');
  });

  test('should not require path parameters if none are present', () => {
    const url = getApiUrl('/projects/');

    expect(url).toBe('/projects/');
  });

  test('should encode path parameters correctly', () => {
    const url = getApiUrl('/projects/$orgSlug/$projectSlug/releases/$releaseVersion/', {
      path: {
        orgSlug: 'my-org',
        projectSlug: 'my-project',
        releaseVersion: 'v 1.0.0',
      },
    });

    expect(url).toBe('/projects/my-org/my-project/releases/v%201.0.0/');
  });

  test('should not modify already encoded parameters', () => {
    const url = getApiUrl('/search/$query/', {
      path: {query: 'test%20query'},
    });

    expect(url).toBe('/search/test%20query/');
  });

  test('should stringify number path params', () => {
    const url = getApiUrl('/items/$id/', {
      path: {id: 123},
    });

    expect(url).toBe('/items/123/');
  });

  test('should not do accidental replacements', () => {
    const url = getApiUrl('/projects/$id1/$id', {
      path: {id: '123', id1: '456'},
    });

    expect(url).toBe('/projects/456/123');
  });

  describe('types', () => {
    test('should return branded string type', () => {
      const url = getApiUrl('/projects/$orgSlug/', {
        path: {orgSlug: 'my-org'},
      });

      expectTypeOf(url).toEqualTypeOf<string & {__apiUrl: true}>();
    });
    test('should not allow invalid path parameters', () => {
      getApiUrl('/projects/$orgSlug/', {
        // @ts-expect-error Invalid path parameter
        path: {orgSlug: 'my-org', invalidParam: 'invalid'},
      });
    });

    test('should not allow excess path parameters', () => {
      getApiUrl('/projects/$orgSlug/', {
        staleTime: 0,
        // @ts-expect-error Excess path parameter
        path: {orgSlug: 'my-org', extraParam: 'extra'},
      });
    });

    test('should require path params for paths with parameters', () => {
      expect(() => {
        getApiUrl('/projects/$orgSlug/', {
          // @ts-expect-error Missing required path parameter
          path: {},
        });
      }).toThrow('Missing path param: orgSlug');
    });

    test('should not allow empty path parameters for paths without parameters', () => {
      // @ts-expect-error Expected 1 argument, but got 2
      getApiUrl('/projects/', {path: {}});
    });
  });
});
