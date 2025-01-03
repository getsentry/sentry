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
      expect.objectContaining({query: expect.objectContaining({title: 'new title'})})
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({description: 'new description'}),
      })
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
        })
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
        })
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

      expect(result.current.state.limit).toEqual(4);

      act(() => {
        result.current.dispatch({
          type: BuilderStateAction.SET_LIMIT,
          payload: 10,
        });
      });

      expect(result.current.state.limit).toEqual(10);
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
});
