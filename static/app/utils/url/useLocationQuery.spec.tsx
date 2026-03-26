import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  decodeInteger,
  decodeList,
  decodeScalar,
  type QueryValue,
} from 'sentry/utils/queryString';
import {useLocationQuery} from 'sentry/utils/url/useLocationQuery';
const initialRouterConfig = {
  route: '/mock-pathname/',
  location: {
    pathname: '/mock-pathname/',
  },
};

describe('useLocationQuery', () => {
  it('should read query values from the url', () => {
    const {result} = renderHookWithProviders(useLocationQuery, {
      initialProps: {
        fields: {
          name: decodeScalar,
          age: decodeInteger,
          titles: decodeList,
        },
      },
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {
          ...initialRouterConfig.location,
          query: {
            name: 'Adam',
            age: '12',
            titles: ['Mr.', 'Dr.'],
            extra: 'foo bar',
          },
        },
      },
    });

    expect(result.current).toStrictEqual({
      name: 'Adam',
      age: 12,
      titles: ['Mr.', 'Dr.'],
    });
  });

  it('should return undefined if the url does not contain a requested field', () => {
    const {result} = renderHookWithProviders(useLocationQuery, {
      initialProps: {
        fields: {
          name: decodeScalar,
          age: decodeInteger,
          titles: decodeList,
        },
      },
      initialRouterConfig,
    });

    expect(result.current).toStrictEqual({
      name: '',
      age: 0,
      titles: [],
    });
  });

  it('allows custom typed decoders', () => {
    type Title = 'Mr' | 'Ms' | 'Mx';

    const titlesDecoder = (value: QueryValue): Title[] | undefined => {
      const decodedValue = decodeList(value);

      const validTitles = decodedValue.filter(v => {
        return ['Mr', 'Ms', 'Mx'].includes(v);
      }) as Title[];

      return validTitles.length > 0 ? validTitles : undefined;
    };

    const {result} = renderHookWithProviders(useLocationQuery, {
      initialProps: {
        fields: {
          titles: titlesDecoder,
        },
      },
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {
          ...initialRouterConfig.location,
          query: {
            titles: ['Mx', 'Dr'],
          },
        },
      },
    });

    expect(result.current).toStrictEqual({
      titles: ['Mx'],
    });
  });

  it('should pass-through static values along with decoded ones', () => {
    const {result} = renderHookWithProviders(useLocationQuery, {
      initialProps: {
        fields: {
          name: decodeScalar,
          stringy: 'bar',
          list: ['biz', 'baz'],
          num: 12,
        },
      },
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {
          ...initialRouterConfig.location,
          query: {
            name: 'Adam',
            titles: ['Mr.', 'Dr.'],
          },
        },
      },
    });

    expect(result.current).toStrictEqual({
      name: 'Adam',
      stringy: 'bar',
      list: ['biz', 'baz'],
      num: 12,
    });
  });

  it('should only change return object identity when values change', async () => {
    const props = {
      fields: {
        name: decodeScalar,
        age: decodeInteger,
        titles: decodeList,
      },
    };
    const {result, router} = renderHookWithProviders(useLocationQuery, {
      initialProps: props,
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {
          ...initialRouterConfig.location,
          query: {
            name: 'Adam',
            titles: ['Mr.', 'Dr.'],
          },
        },
      },
    });
    const first = result.current;

    router.navigate('/mock-pathname/?name=Adam&titles=Mr.&titles=Dr.');
    await waitFor(() => expect(result.current.name).toBe('Adam'));
    const second = result.current;

    router.navigate('/mock-pathname/?name=Betty');
    await waitFor(() => expect(result.current.name).toBe('Betty'));
    const third = result.current;

    expect(first.name).toBe('Adam');
    expect(second.name).toBe('Adam');
    expect(third.name).toBe('Betty');

    // Must be strict object equality:
    expect(first).toBe(second);

    // Object has changed because a value has changed:
    expect(first).not.toBe(third);
  });
});
