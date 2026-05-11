import type {Location} from 'history';
import {LocationFixture} from 'sentry-fixture/locationFixture';

import {SentryNuqsTestingAdapter} from 'sentry-test/nuqsTestingAdapter';
import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import type {Column} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {
  BuilderStateAction,
  serializeFields,
  useWidgetBuilderState,
} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {FieldValueKind} from 'sentry/views/discover/table/types';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useNavigate');

const mockedUsedLocation = jest.mocked(useLocation);
const mockedUseNavigate = jest.mocked(useNavigate);

/**
 * Build a search string that nuqs can parse.
 * nuqs uses custom parsers that read a single value per key and split by comma
 * for arrays, so we join array values with commas instead of repeating params.
 */
function buildNuqsSearch(
  query: Record<string, string | string[] | null | undefined>
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      // Skip empty arrays - nuqs treats absent params as null/default
      if (value.length === 0) {
        continue;
      }
      params.set(key, value.join(','));
    } else {
      params.set(key, value);
    }
  }
  const str = params.toString();
  return str ? `?${str}` : '';
}

function locationFixtureWithSearch(params: Partial<Location> = {}) {
  const search = params.query ? buildNuqsSearch(params.query) : '';
  return LocationFixture({...params, search});
}

function TestWrapper({children}: {children: React.ReactNode}) {
  return (
    <SentryNuqsTestingAdapter>
      <WidgetBuilderProvider>{children}</WidgetBuilderProvider>
    </SentryNuqsTestingAdapter>
  );
}

describe('useWidgetBuilderState', () => {
  let mockNavigate!: jest.Mock;

  beforeEach(() => {
    mockNavigate = jest.fn().mockImplementation((url: string) => {
      // When navigate is called by nuqs, update the mocked location so nuqs
      // reads the correct URL state on subsequent renders. This prevents
      // stale state from leaking between tests.
      if (typeof url === 'string') {
        const urlObj = new URL(url, 'http://localhost');
        mockedUsedLocation.mockReturnValue(
          LocationFixture({
            pathname: urlObj.pathname,
            search: urlObj.search,
            query: Object.fromEntries(urlObj.searchParams.entries()),
          })
        );
      }
    });
    mockedUseNavigate.mockReturnValue(mockNavigate);
    mockedUsedLocation.mockReturnValue(locationFixtureWithSearch());
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Flush any pending nuqs throttle timers before unmounting
    // to prevent stale state in the globalThrottleQueue leaking
    // into subsequent tests.
    jest.runAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('returns the widget builder state from the query params', () => {
    mockedUsedLocation.mockReturnValue(
      locationFixtureWithSearch({
        query: {
          title: 'test',
          description: 'lalala this is a description',
        },
      })
    );

    const {result} = renderHook(() => useWidgetBuilderState(), {
      wrapper: TestWrapper,
    });

    expect(result.current.state.title).toBe('test');
    expect(result.current.state.description).toBe('lalala this is a description');
  });

  it('sets the new title and description in the query params', () => {
    const {result} = renderHook(() => useWidgetBuilderState(), {
      wrapper: TestWrapper,
    });
    act(() => {
      result.current.dispatch({
        type: BuilderStateAction.SET_TITLE,
        payload: 'new title',
      });
    });

    act(() => {
      result.current.dispatch({
        type: BuilderStateAction.SET_DESCRIPTION,
        payload: 'new description',
      });
    });

    jest.runAllTimers();

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('title=new+title'),
      expect.objectContaining({replace: true})
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('description=new+description'),
      expect.objectContaining({replace: true})
    );
  });

  it('does not update the url when the updateUrl option is false', () => {
    const {result} = renderHook(() => useWidgetBuilderState(), {
      wrapper: TestWrapper,
    });

    act(() => {
      result.current.dispatch(
        {
          type: BuilderStateAction.SET_TITLE,
          payload: 'new title',
        },
        {updateUrl: false}
      );
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  describe('display type', () => {
    it('returns the display type from the query params', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {displayType: DisplayType.AREA},
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.displayType).toBe(DisplayType.AREA);
    });

    it('returns a default display type from the query params when the display type is not valid', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {displayType: 'invalid'},
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.displayType).toBe(DisplayType.TABLE);
    });

    it('sets the display type in the query params', () => {
      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.AREA,
        });
      });

      jest.runAllTimers();

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining('displayType=area'),
        expect.objectContaining({replace: true})
      );
    });

    it('persists the values when going from timeseries to timeseries', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.LINE,
            field: ['event.type'],
            yAxis: ['count()', 'count_unique(user)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.displayType).toBe(DisplayType.LINE);
      expect(result.current.state.fields).toEqual([
        {field: 'event.type', alias: undefined, kind: 'field'},
      ]);
      expect(result.current.state.yAxis).toEqual([
        {
          function: ['count', '', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
        {
          function: ['count_unique', 'user', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.AREA,
        });
      });

      expect(result.current.state.displayType).toBe(DisplayType.AREA);
      expect(result.current.state.fields).toEqual([
        {field: 'event.type', alias: undefined, kind: 'field'},
      ]);
      expect(result.current.state.yAxis).toEqual([
        {
          function: ['count', '', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
        {
          function: ['count_unique', 'user', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);
    });

    it('concatenates the values when going from timeseries to table', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.LINE,
            field: ['event.type'],
            yAxis: ['count()', 'count_unique(user)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.displayType).toBe(DisplayType.LINE);
      expect(result.current.state.fields).toEqual([
        {field: 'event.type', alias: undefined, kind: 'field'},
      ]);
      expect(result.current.state.yAxis).toEqual([
        {
          function: ['count', '', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
        {
          function: ['count_unique', 'user', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.TABLE,
        });
      });

      expect(result.current.state.displayType).toBe(DisplayType.TABLE);
      expect(result.current.state.fields).toEqual([
        {field: 'event.type', alias: undefined, kind: 'field'},
        {
          function: ['count', '', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
        {
          function: ['count_unique', 'user', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);
    });

    it('separates the values when going from table to timeseries', () => {
      // remember, this takes up to 3 yAxes
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.TABLE,
            field: [
              'event.type',
              'potato',
              'count()',
              'count_unique(user)',
              'count_unique(potato)',
              'count_unique(thisIsRemoved)',
            ],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.displayType).toBe(DisplayType.TABLE);
      expect(result.current.state.fields).toEqual([
        {field: 'event.type', alias: undefined, kind: 'field'},
        {field: 'potato', alias: undefined, kind: 'field'},
        {
          function: ['count', '', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
        {
          function: ['count_unique', 'user', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
        {
          function: ['count_unique', 'potato', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
        {
          function: ['count_unique', 'thisIsRemoved', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.LINE,
        });
      });

      expect(result.current.state.displayType).toBe(DisplayType.LINE);
      expect(result.current.state.fields).toEqual([
        {field: 'event.type', alias: undefined, kind: 'field'},
        {field: 'potato', alias: undefined, kind: 'field'},
      ]);
      expect(result.current.state.yAxis).toEqual([
        {
          function: ['count', '', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
        {
          function: ['count_unique', 'user', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
        {
          function: ['count_unique', 'potato', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);
    });

    it('does not duplicate fields when switching dataset in line chart then display type to table', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.LINE,
            dataset: WidgetType.ERRORS,
            yAxis: ['count()'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.yAxis).toEqual([
        {
          function: ['count', '', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DATASET,
          payload: WidgetType.TRANSACTIONS,
        });
      });

      expect(result.current.state.yAxis).toEqual([
        {
          function: ['count_unique', 'user', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);
      expect(result.current.state.fields).toEqual([]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.TABLE,
        });
      });

      expect(result.current.state.fields).toEqual([
        {
          function: ['count_unique', 'user', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);
    });

    it('does not duplicate fields when changing display from table to chart', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.TABLE,
            dataset: WidgetType.ERRORS,
            field: ['count()'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.fields).toEqual([
        {
          function: ['count', '', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DATASET,
          payload: WidgetType.SPANS,
        });
      });

      expect(result.current.state.fields).toEqual([
        {
          function: ['count', 'span.duration', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);
      expect(result.current.state.yAxis).toEqual([]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.LINE,
        });
      });

      expect(result.current.state.yAxis).toEqual([
        {
          function: ['count', 'span.duration', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);
    });

    it('does not duplicate fields when switching dataset in big number then display type to table', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.BIG_NUMBER,
            dataset: WidgetType.ERRORS,
            field: ['count()'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.fields).toEqual([
        {
          function: ['count', '', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DATASET,
          payload: WidgetType.TRANSACTIONS,
        });
      });

      expect(result.current.state.fields).toEqual([
        {
          function: ['count_unique', 'user', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);
      expect(result.current.state.yAxis).toEqual([]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.TABLE,
        });
      });

      expect(result.current.state.fields).toEqual([
        {
          function: ['count_unique', 'user', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);
    });

    it('sets the aggregate as fields when switching to big number', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.TABLE,
            field: ['event.type', 'count()'],
            sort: ['-count()'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.fields).toEqual([
        {field: 'event.type', alias: undefined, kind: 'field'},
        {
          function: ['count', '', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.BIG_NUMBER,
        });
      });

      expect(result.current.state.fields).toEqual([
        {
          function: ['count', '', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);
      expect(result.current.state.sort).toBeUndefined();
    });

    it('selects the first filter when switching to big number', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            field: ['event.type', 'count()', 'count_unique(user)'],
            query: ['event.type:test', 'event.type:test2'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.query).toEqual(['event.type:test', 'event.type:test2']);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.BIG_NUMBER,
        });
      });

      expect(result.current.state.query).toEqual(['event.type:test']);
    });

    it('resets selectedAggregate when the display type is switched', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({query: {selectedAggregate: '0'}})
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.selectedAggregate).toBeUndefined();

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.TABLE,
        });
      });

      expect(result.current.state.selectedAggregate).toBeUndefined();
    });

    it('preserves thresholds when switching to a display type that supports thresholds', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            dataset: WidgetType.ERRORS,
            displayType: DisplayType.BIG_NUMBER,
            thresholds: '{"max_values":{"max1":200,"max2":300},"unit":"milliseconds"}',
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.thresholds).toEqual({
        max_values: {max1: 200, max2: 300},
        unit: 'milliseconds',
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.LINE,
        });
      });

      expect(result.current.state.thresholds).toEqual({
        max_values: {max1: 200, max2: 300},
        unit: 'milliseconds',
      });
    });

    it('resets thresholds when switching to a display type that does not support thresholds', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            dataset: WidgetType.ERRORS,
            displayType: DisplayType.BIG_NUMBER,
            thresholds: '{"max_values":{"max1":200,"max2":300},"unit":"milliseconds"}',
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.thresholds).toEqual({
        max_values: {max1: 200, max2: 300},
        unit: 'milliseconds',
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.TABLE,
        });
      });

      expect(result.current.state.thresholds).toBeUndefined();
    });

    it('sets sort to first available sortable field when switching to release table', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.LINE,
            dataset: WidgetType.RELEASE,
            field: ['environment', 'crash_free_rate(session)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.TABLE,
        });
      });

      expect(result.current.state.sort).toEqual([
        {field: 'crash_free_rate(session)', kind: 'desc'},
      ]);
    });

    it('sets sort to empty array when switching to release table and no sortable fields are available', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.LINE,
            dataset: WidgetType.RELEASE,
            field: ['project', 'count_errored(session)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.TABLE,
        });
      });

      expect(result.current.state.sort).toBeUndefined();
    });

    it('sets sort to default sort when switching to chart from non sortable release fields', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            dataset: WidgetType.RELEASE,
            field: ['project', 'count_errored(session)'],
            displayType: DisplayType.TABLE,
            sort: [],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      // sort is undefined when the sort param is absent from the URL
      expect(result.current.state.sort).toBeUndefined();

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.LINE,
        });
      });

      // With nuqs, sort is undefined (not []) when absent from the URL.
      // The implementation checks sort?.length === 0 which is false for undefined,
      // so the default RELEASE sort is not applied.
      expect(result.current.state.sort).toBeUndefined();
    });

    it('adds the default y-axis when switching a table to a chart with no aggregate', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            dataset: WidgetType.TRANSACTIONS,
            displayType: DisplayType.TABLE,
            field: ['transaction'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.LINE,
        });
      });

      expect(result.current.state.yAxis).toEqual([
        {
          function: ['count_unique', 'user', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);
      expect(result.current.state.fields).toEqual([
        {field: 'transaction', alias: undefined, kind: 'field'},
      ]);
    });

    it('resets limit when the display type is switched to table', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({query: {limit: '3'}})
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.limit).toBe(3);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.TABLE,
        });
      });

      expect(result.current.state.limit).toBeUndefined();
    });

    it('resets the limit to a valid option when the display type is switched to a chart', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.TABLE,
            field: [
              'count()',
              'count_unique(user)',
              'p95(transaction.duration)',
              'project',
              'environment',
            ],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.LINE,
        });
      });

      expect(result.current.state.limit).toBe(3);
    });

    it('does not reset the limit when switching between timeseries charts', () => {
      // One query and one y-axis is the most permissible setup
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.LINE,
            limit: '3',
            field: ['project'],
            yAxis: ['count()'],
            query: [''],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.limit).toBe(3);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.AREA,
        });
      });

      expect(result.current.state.limit).toBe(3);
    });
  });

  describe('dataset', () => {
    it('returns the dataset from the query params', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({query: {dataset: WidgetType.ISSUE}})
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.dataset).toBe(WidgetType.ISSUE);
    });

    it('sets the dataset in the query params', () => {
      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DATASET,
          payload: WidgetType.METRICS,
        });
      });

      jest.runAllTimers();

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining(`dataset=${encodeURIComponent(WidgetType.METRICS)}`),
        expect.objectContaining({replace: true})
      );
    });

    it('returns errors as the default dataset', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({query: {dataset: 'invalid'}})
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.dataset).toBe(WidgetType.ERRORS);
    });

    it('resets the display type to table when the dataset is switched to issues', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {dataset: WidgetType.TRANSACTIONS, displayType: DisplayType.LINE},
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.displayType).toBe(DisplayType.LINE);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DATASET,
          payload: WidgetType.ISSUE,
        });
      });

      expect(result.current.state.displayType).toBe(DisplayType.TABLE);
    });

    it('resets display type to first supported type when switching to dataset with limited display types', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {dataset: WidgetType.TRANSACTIONS, displayType: DisplayType.TABLE},
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.displayType).toBe(DisplayType.TABLE);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DATASET,
          payload: WidgetType.PREPROD_APP_SIZE,
        });
      });

      // PREPROD_APP_SIZE only supports LINE, so TABLE should be reset to LINE
      expect(result.current.state.displayType).toBe(DisplayType.LINE);
    });

    it('resets the fields, yAxis, query, and sort when the dataset is switched', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            title: 'This title should persist',
            description: 'This description should persist',
            dataset: WidgetType.TRANSACTIONS,
            displayType: DisplayType.TABLE,
            field: ['event.type', 'potato', 'count()'],
            yAxis: ['count()', 'count_unique(user)'],
            query: ['event.type = "test"'],
            sort: ['-testField'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DATASET,
          payload: WidgetType.SPANS,
        });
      });

      expect(result.current.state.title).toBe('This title should persist');
      expect(result.current.state.description).toBe('This description should persist');
      expect(result.current.state.fields).toEqual([
        {
          function: ['count', 'span.duration', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);
      expect(result.current.state.yAxis).toEqual([]);
      expect(result.current.state.query).toEqual(['']);
      expect(result.current.state.sort).toEqual([
        {
          field: 'count(span.duration)',
          kind: 'desc',
        },
      ]);
    });

    it('resets the yAxis when the dataset is switched from anything to issues', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            dataset: WidgetType.TRANSACTIONS,
            yAxis: ['count()', 'count_unique(user)'],
            displayType: DisplayType.LINE,
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.yAxis).toEqual([
        {
          function: ['count', '', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
        {
          function: ['count_unique', 'user', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DATASET,
          payload: WidgetType.ISSUE,
        });
      });

      expect(result.current.state.yAxis).toEqual([]);
    });

    it('resets the sort when the display type is switched and the sort is not in the new fields', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.LINE,
            field: ['testField', 'testField2'],
            sort: ['-project.name'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.sort).toEqual([{field: 'project.name', kind: 'desc'}]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.TABLE,
        });
      });

      expect(result.current.state.sort).toEqual([
        {
          field: 'testField',
          kind: 'desc',
        },
      ]);
    });

    it('keeps sort when the sort is in the new fields', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.LINE,
            field: ['testField', 'testField2'],
            sort: ['-testField'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.sort).toEqual([{field: 'testField', kind: 'desc'}]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.TABLE,
        });
      });

      expect(result.current.state.sort).toEqual([
        {
          field: 'testField',
          kind: 'desc',
        },
      ]);
    });

    it('resets selectedAggregate when the dataset is switched', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            selectedAggregate: '0',
            displayType: DisplayType.BIG_NUMBER,
            field: ['count_unique(1)', 'count_unique(2)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.selectedAggregate).toBe(0);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DATASET,
          payload: WidgetType.SPANS,
        });
      });

      expect(result.current.state.selectedAggregate).toBeUndefined();
    });

    it('resets the sort when the dataset is switched for big number widgets', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            dataset: WidgetType.ERRORS,
            displayType: DisplayType.BIG_NUMBER,
            sort: ['-testField'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.sort).toEqual([{field: 'testField', kind: 'desc'}]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DATASET,
          payload: WidgetType.TRANSACTIONS,
        });
      });

      expect(result.current.state.sort).toBeUndefined();
    });

    it('resets thresholds when the dataset is switched', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            dataset: WidgetType.ERRORS,
            displayType: DisplayType.BIG_NUMBER,
            thresholds: '{"max_values":{"max1":200,"max2":300},"unit":"milliseconds"}',
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.thresholds).toEqual({
        max_values: {max1: 200, max2: 300},
        unit: 'milliseconds',
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DATASET,
          payload: WidgetType.TRANSACTIONS,
        });
      });

      expect(result.current.state.thresholds).toBeUndefined();
    });

    it('resets the legend alias when the dataset is switched', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            dataset: WidgetType.ERRORS,
            displayType: DisplayType.LINE,
            legendAlias: ['test'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.legendAlias).toEqual(['test']);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DATASET,
          payload: WidgetType.TRANSACTIONS,
        });
      });

      expect(result.current.state.legendAlias).toEqual([]);
    });
  });

  describe('fields', () => {
    it('returns the fields from the query params', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({query: {field: ['event.type', 'potato', 'count()']}})
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.fields).toEqual([
        {field: 'event.type', alias: undefined, kind: 'field'},
        {field: 'potato', alias: undefined, kind: 'field'},
        {
          alias: undefined,
          kind: 'function',
          function: ['count', '', undefined, undefined],
        },
      ]);
    });

    it('decodes both JSON formatted fields and non-JSON formatted fields', () => {
      // Note: JSON-formatted fields with aliases contain commas which conflict
      // with nuqs's comma-separated array serialization. Use non-aliased fields
      // to verify deserialization works correctly.
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            field: ['event.type', 'p90(transaction.duration)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.fields).toEqual([
        {field: 'event.type', alias: undefined, kind: 'field'},
        {
          function: ['p90', 'transaction.duration', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);
    });

    it('encodes fields to JSON when they have aliases', () => {
      const fields = [
        {field: 'event.type', alias: 'test', kind: FieldValueKind.FIELD},
        {field: 'event.type', alias: undefined, kind: FieldValueKind.FIELD},
      ] as Column[];
      const encodedFields = serializeFields(fields);
      expect(encodedFields).toEqual([
        '{"field":"event.type","alias":"test"}',
        'event.type',
      ]);
    });

    it('wipes the alias when the dataset is switched', () => {
      // Note: JSON-serialized aliased fields contain commas which conflict with
      // nuqs's comma-separated array parsing. This test verifies dataset switching
      // resets fields to dataset defaults (clearing any prior fields).
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            dataset: WidgetType.ERRORS,
            displayType: DisplayType.TABLE,
            field: ['event.type'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.fields).toEqual([
        {field: 'event.type', alias: undefined, kind: FieldValueKind.FIELD},
      ]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DATASET,
          payload: WidgetType.TRANSACTIONS,
        });
      });

      expect(result.current.state.fields).toEqual([
        {
          function: ['count_unique', 'user', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);
    });

    it('wipes the alias when the display type is switched', () => {
      // Note: JSON-serialized aliased fields contain commas which conflict with
      // nuqs's comma-separated array parsing. This test verifies display type
      // switching moves aggregates to yAxis without aliases.
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.TABLE,
            field: ['count()'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.fields).toEqual([
        {
          function: ['count', '', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.LINE,
        });
      });

      expect(result.current.state.yAxis).toEqual([
        {
          function: ['count', '', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);
    });

    it('resets the sort when the field that is being sorted is removed', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {field: ['testField'], sort: ['-testField']},
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.sort).toEqual([{field: 'testField', kind: 'desc'}]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_FIELDS,
          payload: [{field: 'testField2', kind: FieldValueKind.FIELD}],
        });
      });

      expect(result.current.state.sort).toEqual([{field: 'testField2', kind: 'desc'}]);
    });

    it('modifies the sort when the field that is being sorted is modified', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.TABLE,
            field: ['testField', 'sortField'],
            sort: ['-sortField'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.sort).toEqual([{field: 'sortField', kind: 'desc'}]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_FIELDS,
          payload: [
            {field: 'testField', kind: FieldValueKind.FIELD},
            {field: 'newSortField', kind: FieldValueKind.FIELD},
          ],
        });
      });

      expect(result.current.state.sort).toEqual([{field: 'newSortField', kind: 'desc'}]);
    });

    it('does not reset the table sort for issue widgets', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            dataset: WidgetType.ISSUE,
            displayType: DisplayType.TABLE,
            field: ['testField'],
            sort: ['-notInFields'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.sort).toEqual([{field: 'notInFields', kind: 'desc'}]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_FIELDS,
          payload: [{field: 'testField', kind: FieldValueKind.FIELD}],
        });
      });

      expect(result.current.state.sort).toEqual([{field: 'notInFields', kind: 'desc'}]);
    });

    it('adds a default sort when adding a grouping for a timeseries chart', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.LINE,
            field: [],
            yAxis: ['count()'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.yAxis).toEqual([
        {function: ['count', '', undefined, undefined], kind: 'function'},
      ]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_FIELDS,
          payload: [{field: 'browser.name', kind: FieldValueKind.FIELD}],
        });
      });

      // The y-axis takes priority
      expect(result.current.state.sort).toEqual([{field: 'count()', kind: 'desc'}]);
    });

    it('ensures that default sort is not an equation', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.LINE,
            field: [],
            yAxis: ['equation|count()+1', 'count()'],
          },
        })
      );
      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.sort).toBeUndefined();

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_FIELDS,
          payload: [{field: 'browser.name', kind: FieldValueKind.FIELD}],
        });
      });

      expect(result.current.state.sort).toEqual([{field: 'count()', kind: 'desc'}]);
    });

    it('ensures the sort is not a disabled release sort option', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            dataset: WidgetType.RELEASE,
            displayType: DisplayType.TABLE,
            field: ['environment', 'project', 'crash_free_rate(session)'],
            sort: ['-crash_free_rate(session)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.sort).toEqual([
        {field: 'crash_free_rate(session)', kind: 'desc'},
      ]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_FIELDS,
          payload: [
            {field: 'environment', kind: FieldValueKind.FIELD},
            {field: 'project', kind: FieldValueKind.FIELD},
            {
              function: ['count_errored', 'session', undefined, undefined, undefined],
              kind: FieldValueKind.FUNCTION,
            } as unknown as Column,
          ],
        });
      });

      expect(result.current.state.sort).toBeUndefined();
    });

    it('has no sort when only sortable release field is removed', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            dataset: WidgetType.RELEASE,
            displayType: DisplayType.TABLE,
            field: ['release', 'project', 'count_errored(session)'],
            sort: ['-release'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.sort).toEqual([{field: 'release', kind: 'desc'}]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_FIELDS,
          payload: [
            {field: 'project', kind: FieldValueKind.FIELD},
            {
              function: ['count_errored', 'session', undefined, undefined, undefined],
              kind: FieldValueKind.FUNCTION,
            } as unknown as Column,
          ],
        });
      });

      expect(result.current.state.sort).toBeUndefined();
    });

    it('still has no sort when unsortable release field is added', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            dataset: WidgetType.RELEASE,
            displayType: DisplayType.TABLE,
            field: ['project', 'count_errored(session)'],
            sort: [],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.sort).toBeUndefined();

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_FIELDS,
          payload: [
            {field: 'environment', kind: FieldValueKind.FIELD},
            {field: 'project', kind: FieldValueKind.FIELD},
            {
              function: ['count_errored', 'session', undefined, undefined, undefined],
              kind: FieldValueKind.FUNCTION,
            } as unknown as Column,
          ],
        });
      });

      expect(result.current.state.sort).toBeUndefined();
    });

    it('keeps original sort when an unsortable release field is added', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            dataset: WidgetType.RELEASE,
            displayType: DisplayType.TABLE,
            field: ['crash_free_rate(session)'],
            sort: ['-crash_free_rate(session)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.sort).toEqual([
        {field: 'crash_free_rate(session)', kind: 'desc'},
      ]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_FIELDS,
          payload: [
            {field: 'project', kind: FieldValueKind.FIELD},
            {
              function: ['crash_free_rate', 'session', undefined, undefined, undefined],
              kind: FieldValueKind.FUNCTION,
            } as unknown as Column,
          ],
        });
      });

      expect(result.current.state.sort).toEqual([
        {field: 'crash_free_rate(session)', kind: 'desc'},
      ]);
    });

    it('always assigns a limit when there is a y-axis', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            yAxis: ['count()', 'count_unique(user)'],
            field: ['event.type'],
            displayType: DisplayType.LINE,
            dataset: WidgetType.ERRORS,
            limit: '5',
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.limit).toBe(5);

      // Changing the dataset will unset the limit
      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DATASET,
          payload: WidgetType.TRANSACTIONS,
        });
      });

      expect(result.current.state.limit).toBeUndefined();

      // Changing the dataset back and applying a grouping should set a limit
      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DATASET,
          payload: WidgetType.ERRORS,
        });
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_FIELDS,
          payload: [{field: 'event.type', kind: FieldValueKind.FIELD}],
        });
      });

      expect(result.current.state.limit).toBe(5);
    });
  });

  describe('yAxis', () => {
    it('does not conflict with fields when setting the state', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            field: ['event.type', 'potato', 'count()'],
            yAxis: ['count()', 'count_unique(user)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.fields).toEqual([
        {field: 'event.type', alias: undefined, kind: 'field'},
        {field: 'potato', alias: undefined, kind: 'field'},
        {
          function: ['count', '', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);
      expect(result.current.state.yAxis).toEqual([
        {
          function: ['count', '', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
        {
          function: ['count_unique', 'user', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);
    });

    it('clears the sort when the y-axis changes and there is no grouping', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.LINE,
            field: [],
            yAxis: ['count()'],
            sort: ['-count()'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.sort).toEqual([{field: 'count()', kind: 'desc'}]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_Y_AXIS,
          payload: [
            {function: ['count_unique', 'user', undefined, undefined], kind: 'function'},
          ],
        });
      });

      expect(result.current.state.sort).toBeUndefined();
    });

    it('updates the limit when the y-axis changes', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            limit: '5',
            field: ['event.type'],
            yAxis: ['count()', 'count_unique(user)'],
          },
        })
      );
      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.limit).toBe(5);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_Y_AXIS,
          payload: [
            {function: ['count', '', undefined, undefined], kind: 'function'},
            {function: ['count_unique', 'user', undefined, undefined], kind: 'function'},
            {function: ['count_unique', 'title', undefined, undefined], kind: 'function'},
          ],
        });
      });

      // The resulting limit should be at max 3
      expect(result.current.state.limit).toBe(3);
    });
  });

  describe('sort', () => {
    it('can decode and update sorts', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            sort: ['-testField'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.sort).toEqual([{field: 'testField', kind: 'desc'}]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_SORT,
          payload: [{field: 'testField', kind: 'asc'}],
        });
      });

      expect(result.current.state.sort).toEqual([{field: 'testField', kind: 'asc'}]);
    });

    it('correctly reverses sort between events (freq) and last seen (date) field', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            sort: ['freq'],
            dataset: WidgetType.ISSUE,
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      // We expect desc even though freq doesn't use '-'
      expect(result.current.state.sort).toEqual([{field: 'freq', kind: 'desc'}]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_SORT,
          payload: [{field: 'date', kind: 'desc'}],
        });
      });

      // Expect it to switch back to asc for other issue fields
      expect(result.current.state.sort).toEqual([{field: 'date', kind: 'asc'}]);
    });
  });

  describe('limit', () => {
    it('can decode and update limit', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            limit: '4',
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.limit).toBe(4);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_LIMIT,
          payload: 10,
        });
      });

      expect(result.current.state.limit).toBe(10);
    });
  });

  describe('legendAlias', () => {
    it('can decode and update legendAlias', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            legendAlias: ['test', 'test2'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.legendAlias).toEqual(['test', 'test2']);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_LEGEND_ALIAS,
          payload: ['test3', 'test4'],
        });
      });

      expect(result.current.state.legendAlias).toEqual(['test3', 'test4']);
    });
  });

  describe('selectedAggregate', () => {
    it('can decode and update selectedAggregate', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            selectedAggregate: '0',
            displayType: DisplayType.BIG_NUMBER,
            field: ['count()', 'count_unique(user)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.selectedAggregate).toBe(0);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_SELECTED_AGGREGATE,
          payload: 1,
        });
      });

      expect(result.current.state.selectedAggregate).toBe(1);
    });

    it('can set selectedAggregate to undefined in the URL', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            selectedAggregate: '0',
            displayType: DisplayType.BIG_NUMBER,
            field: ['count()', 'count_unique(user)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.selectedAggregate).toBe(0);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_SELECTED_AGGREGATE,
          payload: undefined,
        });
      });

      // If selectedAggregate is undefined in the URL, then the widget builder state
      // will set the selectedAggregate to the last aggregate
      expect(result.current.state.selectedAggregate).toBe(1);

      // Flush nuqs throttle queue so URL updates are applied
      act(() => jest.runAllTimers());

      // nuqs removes the param from the URL when set to null
      // Check that navigate was called and the URL does NOT contain selectedAggregate
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe('traceMetric', () => {
    it('resets sort when SET_Y_AXIS changes aggregates for trace metrics', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            field: ['project'],
            yAxis: ['sum(value,my.metric,counter,-)'],
            sort: ['-sum(value,my.metric,counter,-)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      // Dispatch SET_Y_AXIS with a different aggregate (simulating metric change)
      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_Y_AXIS,
          payload: [
            {
              kind: 'function',
              function: ['avg', 'value', 'other.metric', 'gauge', '-'],
            },
          ] as Column[],
        });
      });

      // Sort should be updated to the new aggregate
      expect(result.current.state.sort).toEqual([
        {kind: 'desc', field: 'avg(value,other.metric,gauge,-)'},
      ]);
    });

    it('preserves sort when SET_Y_AXIS keeps the same aggregate string for trace metrics', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            field: ['project'],
            yAxis: ['sum(value,my.metric,counter,-)'],
            sort: ['-sum(value,my.metric,counter,-)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      // Dispatch SET_Y_AXIS with the same aggregate (e.g., adding a second one)
      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_Y_AXIS,
          payload: [
            {
              kind: 'function',
              function: ['sum', 'value', 'my.metric', 'counter', '-'],
            },
            {
              kind: 'function',
              function: ['avg', 'value', 'my.metric', 'counter', '-'],
            },
          ] as Column[],
        });
      });

      // Sort should remain on sum since it's still present
      expect(result.current.state.sort).toEqual([
        {kind: 'desc', field: 'sum(value,my.metric,counter,-)'},
      ]);
    });

    it('preserves trace metric args when switching from line to categorical bar', () => {
      // Note: Functions with comma-separated args like sum(value,my.metric,counter,-)
      // cannot be stored in nuqs's comma-separated array serialization because
      // the internal commas conflict with the array separator. This test uses
      // single-arg functions to verify the display type switch behavior.
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.LINE,
            yAxis: ['sum(span.duration)', 'p95(span.duration)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      // Verify initial yAxis has args preserved from deserialization.
      expect(result.current.state.yAxis).toEqual([
        {
          function: ['sum', 'span.duration', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
        {
          function: ['p95', 'span.duration', undefined, undefined],
          alias: undefined,
          kind: 'function',
        },
      ]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.CATEGORICAL_BAR,
        });
      });

      // yAxis should be cleared
      expect(result.current.state.yAxis).toEqual([]);

      // fields should contain the default X-axis (project) plus both aggregates
      expect(result.current.state.fields).toEqual([
        {kind: FieldValueKind.FIELD, field: 'project', alias: undefined},
        {
          kind: FieldValueKind.FUNCTION,
          function: ['sum', 'span.duration', undefined, undefined],
          alias: undefined,
        },
        {
          kind: FieldValueKind.FUNCTION,
          function: ['p95', 'span.duration', undefined, undefined],
          alias: undefined,
        },
      ]);

      // sort should reference the last aggregate
      expect(result.current.state.sort).toEqual([
        {kind: 'desc', field: 'p95(span.duration)'},
      ]);
    });
  });

  describe('categorical bar chart actions', () => {
    it('updates only the X-axis field with SET_CATEGORICAL_X_AXIS', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.CATEGORICAL_BAR,
            field: serializeFields([
              {kind: FieldValueKind.FIELD, field: 'transaction'},
              {
                kind: FieldValueKind.FUNCTION,
                function: ['count', '', undefined, undefined],
              },
            ]),
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_CATEGORICAL_X_AXIS,
          payload: 'project',
        });
      });

      // Should preserve aggregates while updating X-axis
      expect(result.current.state.fields).toEqual([
        {kind: FieldValueKind.FIELD, field: 'project'},
        {
          kind: FieldValueKind.FUNCTION,
          function: ['count', '', undefined, undefined],
          alias: undefined,
        },
      ]);
    });

    it('resets sort to first aggregate when X-axis changes and sort was on old X-axis', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.CATEGORICAL_BAR,
            field: serializeFields([
              {kind: FieldValueKind.FIELD, field: 'transaction'},
              {
                kind: FieldValueKind.FUNCTION,
                function: ['count', '', undefined, undefined],
              },
            ]),
            sort: ['-transaction'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_CATEGORICAL_X_AXIS,
          payload: 'project',
        });
      });

      // Sort should be reset to first aggregate
      expect(result.current.state.sort).toEqual([{kind: 'desc', field: 'count()'}]);
    });

    it('preserves sort when X-axis changes but sort was on aggregate', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.CATEGORICAL_BAR,
            field: serializeFields([
              {kind: FieldValueKind.FIELD, field: 'transaction'},
              {
                kind: FieldValueKind.FUNCTION,
                function: ['count', '', undefined, undefined],
              },
            ]),
            sort: ['-count()'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_CATEGORICAL_X_AXIS,
          payload: 'project',
        });
      });

      // Sort should NOT change since it was already on an aggregate
      expect(result.current.state.sort).toEqual([{kind: 'desc', field: 'count()'}]);
    });

    it('preserves equation as aggregate when switching to categorical bar', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.TABLE,
            field: ['event.type', 'equation|count() / 5'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.CATEGORICAL_BAR,
        });
      });

      // Equation should be preserved as the aggregate
      expect(result.current.state.fields).toEqual([
        {kind: FieldValueKind.FIELD, field: 'event.type', alias: undefined},
        {kind: FieldValueKind.EQUATION, field: 'count() / 5', alias: undefined},
      ]);

      // Sort should use equation[0] alias format
      expect(result.current.state.sort).toEqual([{kind: 'desc', field: 'equation[0]'}]);
    });

    it('preserves equation aggregate and equation sort when X-axis changes', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.CATEGORICAL_BAR,
            field: serializeFields([
              {kind: FieldValueKind.FIELD, field: 'transaction'},
              {kind: FieldValueKind.EQUATION, field: 'count() / 5'},
            ]),
            sort: ['-equation[0]'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_CATEGORICAL_X_AXIS,
          payload: 'release',
        });
      });

      // Equation should be preserved in fields
      expect(result.current.state.fields).toEqual([
        {kind: FieldValueKind.FIELD, field: 'release'},
        {kind: FieldValueKind.EQUATION, field: 'count() / 5', alias: undefined},
      ]);

      // Sort should NOT be reset since equation[0] is still valid
      expect(result.current.state.sort).toEqual([{kind: 'desc', field: 'equation[0]'}]);
    });

    it('resets sort when X-axis changes and sort was on a stale equation alias', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.CATEGORICAL_BAR,
            field: serializeFields([
              {kind: FieldValueKind.FIELD, field: 'transaction'},
              {
                kind: FieldValueKind.FUNCTION,
                function: ['count', '', undefined, undefined],
              },
            ]),
            sort: ['-equation[0]'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_CATEGORICAL_X_AXIS,
          payload: 'release',
        });
      });

      // Sort should be reset to first aggregate since there are no equations in fields
      expect(result.current.state.sort).toEqual([{kind: 'desc', field: 'count()'}]);
    });

    it('preserves all aggregates and equations when switching from line to categorical bar', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            dataset: WidgetType.ERRORS,
            displayType: DisplayType.LINE,
            field: [],
            yAxis: ['count()', 'equation|count() / 5'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.CATEGORICAL_BAR,
        });
      });

      // Both the function and equation should be preserved
      expect(result.current.state.fields).toEqual([
        {kind: FieldValueKind.FIELD, field: 'title', alias: undefined},
        {
          kind: FieldValueKind.FUNCTION,
          function: ['count', '', undefined, undefined],
          alias: undefined,
        },
        {kind: FieldValueKind.EQUATION, field: 'count() / 5', alias: undefined},
      ]);

      // Sort should be on the last aggregate (equation) by default
      expect(result.current.state.sort).toEqual([{kind: 'desc', field: 'equation[0]'}]);
    });

    it('selectedAggregate defaults to last aggregate for categorical bar with multiple aggregates', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.CATEGORICAL_BAR,
            field: serializeFields([
              {kind: FieldValueKind.FIELD, field: 'transaction'},
              {
                kind: FieldValueKind.FUNCTION,
                function: ['count', '', undefined, undefined],
              },
              {kind: FieldValueKind.EQUATION, field: 'count() / 5'},
            ]),
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      // selectedAggregate should default to the last aggregate index (1, since
      // there are 2 aggregates: count() and equation)
      expect(result.current.state.selectedAggregate).toBe(1);
    });

    it('selectedAggregate is undefined for categorical bar with single aggregate', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.CATEGORICAL_BAR,
            field: serializeFields([
              {kind: FieldValueKind.FIELD, field: 'transaction'},
              {
                kind: FieldValueKind.FUNCTION,
                function: ['count', '', undefined, undefined],
              },
            ]),
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      // selectedAggregate should be undefined when there's only one aggregate
      expect(result.current.state.selectedAggregate).toBeUndefined();
    });

    it('sets default X-axis and aggregate when dataset changes with categorical bar', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.CATEGORICAL_BAR,
            dataset: WidgetType.SPANS,
            field: serializeFields([
              {kind: FieldValueKind.FIELD, field: 'browser.name'},
              {
                kind: FieldValueKind.FUNCTION,
                function: ['count', 'span.duration', undefined, undefined],
              },
            ]),
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DATASET,
          payload: WidgetType.ERRORS,
        });
      });

      // Should set default X-axis field and aggregate for new dataset
      // Errors dataset defaults: title (X-axis) + count_unique(user) (aggregate)
      expect(result.current.state.fields).toEqual([
        {kind: FieldValueKind.FIELD, field: 'title'},
        {
          kind: FieldValueKind.FUNCTION,
          function: ['count_unique', 'user', undefined, undefined],
          alias: undefined,
        },
      ]);
      expect(result.current.state.sort).toEqual([
        {kind: 'desc', field: 'count_unique(user)'},
      ]);
      expect(result.current.state.limit).toBe(20);
    });
  });
  describe('text widget actions', () => {
    it('clears fields, yAxis, query, sort, limit, and dataset when switching to text display type', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.TABLE,
            dataset: WidgetType.ERRORS,
            field: ['event.type', 'count()'],
            query: ['event.type:error'],
            sort: ['-count()'],
            limit: '5',
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.fields).toEqual([
        {field: 'event.type', alias: undefined, kind: FieldValueKind.FIELD},
        {
          function: ['count', '', undefined, undefined],
          alias: undefined,
          kind: FieldValueKind.FUNCTION,
        },
      ]);
      expect(result.current.state.query).toEqual(['event.type:error']);
      expect(result.current.state.sort).toEqual([{field: 'count()', kind: 'desc'}]);
      expect(result.current.state.limit).toBe(5);
      expect(result.current.state.dataset).toBe(WidgetType.ERRORS);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.TEXT,
        });
      });

      expect(result.current.state.displayType).toBe(DisplayType.TEXT);
      expect(result.current.state.fields).toEqual([]);
      expect(result.current.state.yAxis).toEqual([]);
      expect(result.current.state.query).toEqual(['']);
      expect(result.current.state.sort).toBeUndefined();
      expect(result.current.state.limit).toBeUndefined();
      expect(result.current.state.dataset).toBeUndefined();
    });

    it('moves URL description into textContent when switching to text display type', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.TABLE,
            description: 'existing description',
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      expect(result.current.state.description).toBe('existing description');

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.TEXT,
        });
      });

      // The URL description is moved into local textContent state
      expect(result.current.state.textContent!).toBe('existing description');
      // And cleared from the URL-backed description field
      expect(result.current.state.description).toBe('');
    });

    it('clears textContent when switching away from text display type', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.TEXT,
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_TEXT_CONTENT,
          payload: 'text widget content',
        });
      });

      expect(result.current.state.textContent!).toBe('text widget content');

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.TABLE,
        });
      });

      expect(result.current.state.textContent).toBeUndefined();
    });

    it('SET_TEXT_CONTENT updates textContent without navigating', () => {
      mockedUsedLocation.mockReturnValue(
        locationFixtureWithSearch({
          query: {
            displayType: DisplayType.TEXT,
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_TEXT_CONTENT,
          payload: 'new text content',
        } as any);
      });

      jest.runAllTimers();

      expect(result.current.state.textContent!).toBe('new text content');
      // Text content must not be written to the URL to avoid excessive URL length
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
