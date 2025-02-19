import {LocationFixture} from 'sentry-fixture/locationFixture';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import type {Column} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import useWidgetBuilderState, {
  BuilderStateAction,
  serializeFields,
} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {FieldValueKind} from 'sentry/views/discover/table/types';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useNavigate');

const mockedUsedLocation = jest.mocked(useLocation);
const mockedUseNavigate = jest.mocked(useNavigate);

describe('useWidgetBuilderState', () => {
  let mockNavigate!: jest.Mock;
  beforeEach(() => {
    mockNavigate = jest.fn();
    mockedUseNavigate.mockReturnValue(mockNavigate);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('returns the widget builder state from the query params', () => {
    mockedUsedLocation.mockReturnValue(
      LocationFixture({
        query: {
          title: 'test',
          description: 'lalala this is a description',
        },
      })
    );

    const {result} = renderHook(() => useWidgetBuilderState(), {
      wrapper: WidgetBuilderProvider,
    });

    expect(result.current.state.title).toBe('test');
    expect(result.current.state.description).toBe('lalala this is a description');
  });

  it('sets the new title and description in the query params', () => {
    const {result} = renderHook(() => useWidgetBuilderState(), {
      wrapper: WidgetBuilderProvider,
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
      expect.objectContaining({
        query: expect.objectContaining({title: 'new title'}),
      }),
      {replace: true}
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({description: 'new description'}),
      }),
      {replace: true}
    );
  });

  describe('display type', () => {
    it('returns the display type from the query params', () => {
      mockedUsedLocation.mockReturnValue(
        LocationFixture({
          query: {displayType: DisplayType.AREA},
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
      });

      expect(result.current.state.displayType).toBe(DisplayType.AREA);
    });

    it('returns a default display type from the query params when the display type is not valid', () => {
      mockedUsedLocation.mockReturnValue(
        LocationFixture({
          query: {displayType: 'invalid'},
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
      });

      expect(result.current.state.displayType).toBe(DisplayType.TABLE);
    });

    it('sets the display type in the query params', () => {
      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.AREA,
        });
      });

      jest.runAllTimers();

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({displayType: DisplayType.AREA}),
        }),
        {replace: true}
      );
    });

    it('persists the values when going from timeseries to timeseries', () => {
      mockedUsedLocation.mockReturnValue(
        LocationFixture({
          query: {
            displayType: DisplayType.LINE,
            field: ['event.type'],
            yAxis: ['count()', 'count_unique(user)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({
          query: {
            displayType: DisplayType.LINE,
            field: ['event.type'],
            yAxis: ['count()', 'count_unique(user)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({
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
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({
          query: {
            displayType: DisplayType.LINE,
            dataset: WidgetType.ERRORS,
            yAxis: ['count()'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({
          query: {
            displayType: DisplayType.TABLE,
            dataset: WidgetType.ERRORS,
            field: ['count()'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({
          query: {
            displayType: DisplayType.BIG_NUMBER,
            dataset: WidgetType.ERRORS,
            field: ['count()'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({
          query: {
            displayType: DisplayType.TABLE,
            field: ['event.type', 'count()'],
            sort: ['-count()'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
      expect(result.current.state.sort).toEqual([]);
    });

    it('selects the first filter when switching to big number', () => {
      mockedUsedLocation.mockReturnValue(
        LocationFixture({
          query: {
            field: ['event.type', 'count()', 'count_unique(user)'],
            query: ['event.type:test', 'event.type:test2'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({query: {selectedAggregate: '0'}})
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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

    it('resets thresholds when the display type is switched', () => {
      mockedUsedLocation.mockReturnValue(
        LocationFixture({
          query: {
            dataset: WidgetType.ERRORS,
            displayType: DisplayType.BIG_NUMBER,
            thresholds: '{"max_values":{"max1":200,"max2":300},"unit":"milliseconds"}',
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({
          query: {
            displayType: DisplayType.LINE,
            dataset: WidgetType.RELEASE,
            field: ['environment', 'crash_free_rate(session)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({
          query: {
            displayType: DisplayType.LINE,
            dataset: WidgetType.RELEASE,
            field: ['project', 'count_errored(session)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.TABLE,
        });
      });

      expect(result.current.state.sort).toEqual([]);
    });

    it('sets sort to default sort when switching to chart from non sortable release fields', () => {
      mockedUsedLocation.mockReturnValue(
        LocationFixture({
          query: {
            dataset: WidgetType.RELEASE,
            field: ['project', 'count_errored(session)'],
            displayType: DisplayType.TABLE,
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
      });

      expect(result.current.state.sort).toEqual([]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: DisplayType.LINE,
        });
      });

      expect(result.current.state.sort).toEqual([
        {field: 'crash_free_rate(session)', kind: 'desc'},
      ]);
    });
  });

  describe('dataset', () => {
    it('returns the dataset from the query params', () => {
      mockedUsedLocation.mockReturnValue(
        LocationFixture({query: {dataset: WidgetType.ISSUE}})
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
      });

      expect(result.current.state.dataset).toBe(WidgetType.ISSUE);
    });

    it('sets the dataset in the query params', () => {
      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
      });

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DATASET,
          payload: WidgetType.METRICS,
        });
      });

      jest.runAllTimers();

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({dataset: WidgetType.METRICS}),
        }),
        {replace: true}
      );
    });

    it('returns errors as the default dataset', () => {
      mockedUsedLocation.mockReturnValue(LocationFixture({query: {dataset: 'invalid'}}));

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
      });

      expect(result.current.state.dataset).toBe(WidgetType.ERRORS);
    });

    it('resets the display type to table when the dataset is switched to issues', () => {
      mockedUsedLocation.mockReturnValue(
        LocationFixture({
          query: {dataset: WidgetType.TRANSACTIONS, displayType: DisplayType.LINE},
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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

    it('resets the fields, yAxis, query, and sort when the dataset is switched', () => {
      mockedUsedLocation.mockReturnValue(
        LocationFixture({
          query: {
            title: 'This title should persist',
            description: 'This description should persist',
            dataset: WidgetType.TRANSACTIONS,
            field: ['event.type', 'potato', 'count()'],
            yAxis: ['count()', 'count_unique(user)'],
            query: ['event.type = "test"'],
            sort: ['-testField'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({
          query: {
            dataset: WidgetType.TRANSACTIONS,
            yAxis: ['count()', 'count_unique(user)'],
            displayType: DisplayType.LINE,
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({
          query: {
            displayType: DisplayType.LINE,
            field: ['testField', 'testField2'],
            sort: ['-project.name'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({
          query: {
            displayType: DisplayType.LINE,
            field: ['testField', 'testField2'],
            sort: ['-testField'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({
          query: {
            selectedAggregate: '0',
            displayType: DisplayType.BIG_NUMBER,
            field: ['count_unique(1)', 'count_unique(2)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({
          query: {
            dataset: WidgetType.ERRORS,
            displayType: DisplayType.BIG_NUMBER,
            sort: ['-testField'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
      });

      expect(result.current.state.sort).toEqual([{field: 'testField', kind: 'desc'}]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_DATASET,
          payload: WidgetType.TRANSACTIONS,
        });
      });

      expect(result.current.state.sort).toEqual([]);
    });

    it('resets thresholds when the dataset is switched', () => {
      mockedUsedLocation.mockReturnValue(
        LocationFixture({
          query: {
            dataset: WidgetType.ERRORS,
            displayType: DisplayType.BIG_NUMBER,
            thresholds: '{"max_values":{"max1":200,"max2":300},"unit":"milliseconds"}',
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({
          query: {
            dataset: WidgetType.ERRORS,
            displayType: DisplayType.LINE,
            legendAlias: ['test'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({query: {field: ['event.type', 'potato', 'count()']}})
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
      mockedUsedLocation.mockReturnValue(
        LocationFixture({
          query: {
            field: [
              '{"field": "event.type", "alias": "test"}',
              'p90(transaction.duration)',
            ],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
      });

      expect(result.current.state.fields).toEqual([
        {field: 'event.type', alias: 'test', kind: 'field'},
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
      mockedUsedLocation.mockReturnValue(
        LocationFixture({
          query: {
            dataset: WidgetType.ERRORS,
            displayType: DisplayType.TABLE,
            field: ['{"field":"event.type","alias":"test"}'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
      });

      expect(result.current.state.fields).toEqual([
        {field: 'event.type', alias: 'test', kind: FieldValueKind.FIELD},
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
      mockedUsedLocation.mockReturnValue(
        LocationFixture({
          query: {
            displayType: DisplayType.TABLE,
            field: ['{"field":"count()","alias":"test"}'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
      });

      expect(result.current.state.fields).toEqual([
        {function: ['count', '', undefined, undefined], alias: 'test', kind: 'function'},
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
        LocationFixture({
          query: {field: ['testField'], sort: ['-testField']},
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({
          query: {field: ['testField', 'sortField'], sort: ['-sortField']},
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({
          query: {
            dataset: WidgetType.ISSUE,
            field: ['testField'],
            sort: ['-notInFields'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({
          query: {
            displayType: DisplayType.LINE,
            field: [],
            yAxis: ['count()'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({
          query: {
            displayType: DisplayType.LINE,
            field: [],
            yAxis: ['equation|count()+1', 'count()'],
          },
        })
      );
      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
      });

      expect(result.current.state.sort).toEqual([]);

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
        LocationFixture({
          query: {
            dataset: WidgetType.RELEASE,
            field: ['environment, project, crash_free_rate(session)'],
            sort: ['-crash_free_rate(session)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
      });

      expect(result.current.state.sort).toEqual([
        {field: 'crash_free_rate(session)', kind: 'desc'},
      ]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_FIELDS,
          payload: [
            {field: 'environment', kind: FieldValueKind.FIELD} as Column,
            {field: 'project', kind: FieldValueKind.FIELD} as Column,
            {
              function: ['count_errored', 'session', undefined, undefined, undefined],
              kind: FieldValueKind.FUNCTION,
            } as unknown as Column,
          ],
        });
      });

      expect(result.current.state.sort).toEqual([]);
    });

    it('has no sort when only sortable release field is removed', () => {
      mockedUsedLocation.mockReturnValue(
        LocationFixture({
          query: {
            dataset: WidgetType.RELEASE,
            field: ['release', 'project', 'count_errored(session)'],
            sort: ['-release'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
      });

      expect(result.current.state.sort).toEqual([{field: 'release', kind: 'desc'}]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_FIELDS,
          payload: [
            {field: 'project', kind: FieldValueKind.FIELD} as Column,
            {
              function: ['count_errored', 'session', undefined, undefined, undefined],
              kind: FieldValueKind.FUNCTION,
            } as unknown as Column,
          ],
        });
      });

      expect(result.current.state.sort).toEqual([]);
    });

    it('still has no sort when unsortable release field is added', () => {
      mockedUsedLocation.mockReturnValue(
        LocationFixture({
          query: {
            dataset: WidgetType.RELEASE,
            field: ['project', 'count_errored(session)'],
            sort: [],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
      });

      expect(result.current.state.sort).toEqual([]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_FIELDS,
          payload: [
            {field: 'environment', kind: FieldValueKind.FIELD} as Column,
            {field: 'project', kind: FieldValueKind.FIELD} as Column,
            {
              function: ['count_errored', 'session', undefined, undefined, undefined],
              kind: FieldValueKind.FUNCTION,
            } as unknown as Column,
          ],
        });
      });

      expect(result.current.state.sort).toEqual([]);
    });

    it('keeps original sort when an unsortable release field is added', () => {
      mockedUsedLocation.mockReturnValue(
        LocationFixture({
          query: {
            dataset: WidgetType.RELEASE,
            field: ['crash_free_rate(session)'],
            sort: ['-crash_free_rate(session)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
      });

      expect(result.current.state.sort).toEqual([
        {field: 'crash_free_rate(session)', kind: 'desc'},
      ]);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_FIELDS,
          payload: [
            {field: 'project', kind: FieldValueKind.FIELD} as Column,
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
  });

  describe('yAxis', () => {
    it('does not conflict with fields when setting the state', () => {
      mockedUsedLocation.mockReturnValue(
        LocationFixture({
          query: {
            field: ['event.type', 'potato', 'count()'],
            yAxis: ['count()', 'count_unique(user)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({
          query: {
            displayType: DisplayType.LINE,
            field: [],
            yAxis: ['count()'],
            sort: ['-count()'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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

      expect(result.current.state.sort).toEqual([]);
    });
  });

  describe('sort', () => {
    it('can decode and update sorts', () => {
      mockedUsedLocation.mockReturnValue(
        LocationFixture({
          query: {
            sort: ['-testField'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
  });

  describe('limit', () => {
    it('can decode and update limit', () => {
      mockedUsedLocation.mockReturnValue(
        LocationFixture({
          query: {
            limit: '4',
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({
          query: {
            legendAlias: ['test', 'test2'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({
          query: {
            selectedAggregate: '0',
            displayType: DisplayType.BIG_NUMBER,
            field: ['count()', 'count_unique(user)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
        LocationFixture({
          query: {
            selectedAggregate: '0',
            displayType: DisplayType.BIG_NUMBER,
            field: ['count()', 'count_unique(user)'],
          },
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState(), {
        wrapper: WidgetBuilderProvider,
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
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({selectedAggregate: undefined}),
        }),
        {replace: true}
      );
    });
  });
});
