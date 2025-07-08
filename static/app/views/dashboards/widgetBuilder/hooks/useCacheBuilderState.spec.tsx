import {LocationFixture} from 'sentry-fixture/locationFixture';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {
  useWidgetBuilderContext,
  WidgetBuilderProvider,
} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {
  BuilderStateAction,
  type WidgetBuilderState,
} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {convertBuilderStateToWidget} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';

import {useCacheBuilderState} from './useCacheBuilderState';

jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: jest.fn(),
}));
jest.mock('sentry/utils/useLocation');

jest.mock('sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext', () => ({
  useWidgetBuilderContext: jest.fn(),
  WidgetBuilderProvider: jest.requireActual(
    'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext'
  ).WidgetBuilderProvider,
}));

const mockUseWidgetBuilderContext = jest.mocked(useWidgetBuilderContext);
const mockUseLocation = jest.mocked(useLocation);

function Wrapper({children}: {children: React.ReactNode}) {
  return <WidgetBuilderProvider>{children}</WidgetBuilderProvider>;
}

describe('useCacheBuilderState', () => {
  let mockLocalStorage: Record<string, string>;

  beforeEach(() => {
    mockLocalStorage = {};
    mockUseWidgetBuilderContext.mockReturnValue({
      state: {},
      dispatch: jest.fn(),
    });
    mockUseLocation.mockReturnValue(LocationFixture());

    Storage.prototype.getItem = jest.fn(key => mockLocalStorage[key] ?? null);
    Storage.prototype.setItem = jest.fn((key, value) => {
      mockLocalStorage[key] = value;
    });
    Storage.prototype.removeItem = jest.fn(key => {
      delete mockLocalStorage[key];
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('caches builder state to localStorage', () => {
    const cachedWidget: WidgetBuilderState = {
      dataset: WidgetType.ERRORS,
      displayType: DisplayType.LINE,
      yAxis: [
        {
          function: ['count', '', undefined, undefined],
          kind: 'function',
        },
      ],
      query: ['this is a test query'],
    };
    mockUseWidgetBuilderContext.mockReturnValue({
      state: cachedWidget,
      dispatch: jest.fn(),
    });

    const {result} = renderHook(() => useCacheBuilderState(), {
      wrapper: Wrapper,
    });

    result.current.cacheBuilderState(WidgetType.ERRORS);

    // Verify state was saved to localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'dashboards:widget-builder:dataset:error-events',
      JSON.stringify(convertBuilderStateToWidget(cachedWidget))
    );

    result.current.restoreOrSetBuilderState(WidgetType.ERRORS);

    expect(localStorage.getItem).toHaveBeenCalledWith(
      'dashboards:widget-builder:dataset:error-events'
    );
  });

  it('restores builder state from localStorage when available', () => {
    const cachedWidget: WidgetBuilderState = {
      title: 'error widget title',
      description: 'error widget description',
      dataset: WidgetType.ERRORS,
      displayType: DisplayType.LINE,
      yAxis: [
        {
          function: ['count', '', undefined, undefined],
          kind: 'function',
        },
      ],
      query: ['this is a test query'],
    };
    const currentWidget: WidgetBuilderState = {
      title: 'issue widget title',
      description: 'issue widget description',
      dataset: WidgetType.ISSUE,
      displayType: DisplayType.TABLE,
      query: ['issue.id:123'],
      fields: [
        {
          field: 'issue',
          kind: 'field',
        },
      ],
    };
    const mockDispatch = jest.fn();
    mockUseWidgetBuilderContext.mockReturnValue({
      state: currentWidget,
      dispatch: mockDispatch,
    });
    // Add cached widget to the localStorage
    localStorage.setItem(
      'dashboards:widget-builder:dataset:error-events',
      JSON.stringify(convertBuilderStateToWidget(cachedWidget))
    );

    const {result} = renderHook(() => useCacheBuilderState(), {
      wrapper: Wrapper,
    });

    // Call the restore helper on the cached dataset
    result.current.restoreOrSetBuilderState(WidgetType.ERRORS);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: BuilderStateAction.SET_STATE,

      // the yAxis gets converted to a string when used with this payload
      payload: expect.objectContaining({
        ...cachedWidget,
        yAxis: ['count()'],
        title: 'issue widget title', // The title was not overridden
        description: 'issue widget description', // The description was not overridden
      }),
    });
  });

  it('plainly sets the new dataset when no cached state exists', () => {
    const cachedWidget: WidgetBuilderState = {
      dataset: WidgetType.ERRORS,
      displayType: DisplayType.LINE,
      yAxis: [
        {
          function: ['count', '', undefined, undefined],
          kind: 'function',
        },
      ],
      query: ['this is a test query'],
    };
    const currentWidget: WidgetBuilderState = {
      dataset: WidgetType.ISSUE,
      displayType: DisplayType.TABLE,
      query: ['issue.id:123'],
      fields: [
        {
          field: 'issue',
          kind: 'field',
        },
      ],
    };
    const mockDispatch = jest.fn();
    mockUseWidgetBuilderContext.mockReturnValue({
      state: currentWidget,
      dispatch: mockDispatch,
    });
    // Add cached widget to the localStorage, this will not be the one
    // used in the test to test that a cache miss falls back to the plain
    // dataset change
    localStorage.setItem(
      'dashboards:widget-builder:dataset:error-events',
      JSON.stringify(convertBuilderStateToWidget(cachedWidget))
    );

    const {result} = renderHook(() => useCacheBuilderState(), {
      wrapper: Wrapper,
    });

    // Call the restore helper on the cached dataset
    result.current.restoreOrSetBuilderState(WidgetType.TRANSACTIONS);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: BuilderStateAction.SET_DATASET,
      payload: WidgetType.TRANSACTIONS,
    });
  });
});
