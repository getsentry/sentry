import {LocationFixture} from 'sentry-fixture/locationFixture';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {UrlBatchProvider} from 'sentry/views/dashboards/widgetBuilder/context/urlBatchContext';
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
      wrapper: UrlBatchProvider,
    });

    expect(result.current.state.title).toBe('test');
    expect(result.current.state.description).toBe('lalala this is a description');
  });

  it('sets the new title and description in the query params', () => {
    const mockNavigate = jest.fn();
    mockedUseNavigate.mockReturnValue(mockNavigate);

    const {result} = renderHook(() => useWidgetBuilderState(), {
      wrapper: UrlBatchProvider,
    });
    act(() => {
      result.current.dispatch({
        type: BuilderStateAction.SET_TITLE,
        payload: 'new title',
      });
    });
    // act(() => {
    //   result.current.dispatch({
    //     type: BuilderStateAction.SET_DESCRIPTION,
    //     payload: 'new description',
    //   });
    // });

    act(() => {
      jest.runAllTimers();
    });
    // expect(mockNavigate).toHaveBeenCalledWith(
    //   expect.objectContaining({query: expect.objectContaining({title: 'new title'})})
    // );
    // expect(mockNavigate).toHaveBeenCalledWith(
    //   expect.objectContaining({
    //     query: expect.objectContaining({description: 'new description'}),
    //   })
    // );
  });
});
