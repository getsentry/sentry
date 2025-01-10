import type {Location} from 'history';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import {
  decodeInteger,
  decodeList,
  decodeScalar,
  type QueryValue,
} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';

jest.mock('sentry/utils/useLocation');

const mockLocation: Location = {
  key: '',
  search: '',
  hash: '',
  action: 'PUSH',
  state: null,
  query: {},
  pathname: '/mock-pathname/',
};

describe('useLocationQuery', () => {
  it('should read query values from the url', () => {
    jest.mocked(useLocation).mockReturnValue({
      ...mockLocation,
      query: {
        name: 'Adam',
        age: '12',
        titles: ['Mr.', 'Dr.'],
        extra: 'foo bar',
      },
    } as Location);

    const {result} = renderHook(useLocationQuery, {
      initialProps: {
        fields: {
          name: decodeScalar,
          age: decodeInteger,
          titles: decodeList,
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
    jest.mocked(useLocation).mockReturnValue({
      ...mockLocation,
      query: {},
    } as Location);

    const {result} = renderHook(useLocationQuery, {
      initialProps: {
        fields: {
          name: decodeScalar,
          age: decodeInteger,
          titles: decodeList,
        },
      },
    });

    expect(result.current).toStrictEqual({
      name: '',
      age: 0,
      titles: [],
    });
  });

  it('allows custom typed decoders', () => {
    jest.mocked(useLocation).mockReturnValueOnce({
      ...mockLocation,
      query: {
        titles: ['Mx', 'Dr'],
      },
    } as Location);

    type Title = 'Mr' | 'Ms' | 'Mx';

    const titlesDecoder = (value: QueryValue): Title[] | undefined => {
      const decodedValue = decodeList(value);

      const validTitles = decodedValue.filter(v => {
        return ['Mr', 'Ms', 'Mx'].includes(v);
      }) as Title[];

      return validTitles.length > 0 ? validTitles : undefined;
    };

    const {result} = renderHook(useLocationQuery, {
      initialProps: {
        fields: {
          titles: titlesDecoder,
        },
      },
    });

    expect(result.current).toStrictEqual({
      titles: ['Mx'],
    });
  });

  it('should pass-through static values along with decoded ones', () => {
    jest.mocked(useLocation).mockReturnValueOnce({
      ...mockLocation,
      query: {
        name: 'Adam',
        titles: ['Mr.', 'Dr.'],
      },
    } as Location);

    const {result} = renderHook(useLocationQuery, {
      initialProps: {
        fields: {
          name: decodeScalar,
          stringy: 'bar',
          list: ['biz', 'baz'],
          num: 12,
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

  it('should only change return object identity when values change', () => {
    // 1st render:
    jest.mocked(useLocation).mockReturnValueOnce({
      ...mockLocation,
      query: {
        name: 'Adam',
        titles: ['Mr.', 'Dr.'],
      },
    } as Location);
    // 2nd render, same values (but the array is re-built, new object ref):
    jest.mocked(useLocation).mockReturnValueOnce({
      ...mockLocation,
      query: {
        name: 'Adam',
        titles: ['Mr.', 'Dr.'],
      },
    } as Location);
    // 3rd render, name is changed.
    jest.mocked(useLocation).mockReturnValueOnce({
      ...mockLocation,
      query: {
        name: 'Betty',
      },
    } as Location);

    const props = {
      fields: {
        name: decodeScalar,
        age: decodeInteger,
        titles: decodeList,
      },
    };
    const {result, rerender} = renderHook(useLocationQuery, {
      initialProps: props,
    });
    const first = result.current;
    rerender(props);
    const second = result.current;
    rerender(props);
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
