import {LocationFixture} from 'sentry-fixture/locationFixture';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {DisplayType} from 'sentry/views/dashboards/types';
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

    const {result} = renderHook(() => useWidgetBuilderState());

    expect(result.current.state.title).toBe('test');
    expect(result.current.state.description).toBe('lalala this is a description');
  });

  it('sets the new title and description in the query params', () => {
    const mockNavigate = jest.fn();
    mockedUseNavigate.mockReturnValue(mockNavigate);

    const {result} = renderHook(() => useWidgetBuilderState());
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

      const {result} = renderHook(() => useWidgetBuilderState());

      expect(result.current.state.displayType).toBe(DisplayType.AREA);
    });

    it('returns a default display type from the query params when the display type is not valid', () => {
      mockedUsedLocation.mockReturnValue(
        LocationFixture({
          query: {displayType: 'invalid'},
        })
      );

      const {result} = renderHook(() => useWidgetBuilderState());

      expect(result.current.state.displayType).toBe(DisplayType.TABLE);
    });

    it('sets the display type in the query params', () => {
      const mockNavigate = jest.fn();
      mockedUseNavigate.mockReturnValue(mockNavigate);

      const {result} = renderHook(() => useWidgetBuilderState());

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
});
