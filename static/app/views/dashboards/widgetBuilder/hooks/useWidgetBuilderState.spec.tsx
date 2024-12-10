import {LocationFixture} from 'sentry-fixture/locationFixture';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import useWidgetBuilderState, {
  BuilderStateAction,
} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useNavigate');

const mockedUsedLocation = jest.mocked(useLocation);
const mockedUseNavigate = jest.mocked(useNavigate);

describe('useWidgetBuilderState', () => {
  beforeEach(() => {
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
    const mockNavigate = jest.fn();
    mockedUseNavigate.mockReturnValue(mockNavigate);

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
      const mockNavigate = jest.fn();
      mockedUseNavigate.mockReturnValue(mockNavigate);

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
      const mockNavigate = jest.fn();
      mockedUseNavigate.mockReturnValue(mockNavigate);

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
});
