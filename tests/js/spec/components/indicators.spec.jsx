import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  cleanup,
  fireEvent,
  mountWithTheme,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {
  addErrorMessage,
  addMessage,
  addSuccessMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import Indicators from 'app/components/indicators';
import IndicatorStore from 'app/stores/indicatorStore';

// Make sure we use `duration: null` to test add/remove
jest.useFakeTimers();

jest.mock('framer-motion', () => ({
  ...jest.requireActual('framer-motion'),
  AnimatePresence: jest.fn(({children}) => children),
}));

function createWrapper(props = {}) {
  const {routerContext} = initializeOrg(props);
  return mountWithTheme(<Indicators />, {context: routerContext});
}

describe('Indicators', function () {
  let wrapper;
  beforeEach(function () {
    wrapper = createWrapper();

    clearIndicators();
    jest.runAllTimers();
  });

  afterEach(function () {
    cleanup();
  });

  it('renders nothing by default', function () {
    expect(wrapper.container).toHaveTextContent('');
  });

  it('has a loading indicator by default', function () {
    // when "type" is empty, we should treat it as loading state
    IndicatorStore.add('Loading');
    expect(wrapper.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(wrapper.container).toHaveTextContent('Loading');
  });

  it('adds and removes a toast by calling IndicatorStore directly', function () {
    // when "type" is empty, we should treat it as loading state
    const indicator = IndicatorStore.add('Loading');
    expect(wrapper.container).toHaveTextContent('Loading');

    // Old indicator gets replaced when a new one is added
    IndicatorStore.remove(indicator);
    expect(wrapper.container).toHaveTextContent('');
  });

  // This is a common pattern used throughout the code for API calls
  it('adds and replaces toast by calling IndicatorStore directly', function () {
    IndicatorStore.add('Loading');
    expect(wrapper.container).toHaveTextContent('Loading');

    // Old indicator gets replaced when a new one is added
    IndicatorStore.add('success', 'success');
    expect(wrapper.container).toHaveTextContent('success');
  });

  it('does not have loading indicator when "type" is empty (default)', function () {
    addMessage('Loading', '', {duration: null});
    jest.runAllTimers();
    expect(wrapper.container).toHaveTextContent('Loading');
    expect(wrapper.queryByTestId('loading-indicator')).toBeNull();
  });

  it('has a loading indicator when type is "loading"', function () {
    addMessage('Loading', 'loading', {duration: null});
    jest.runAllTimers();
    expect(wrapper.container).toHaveTextContent('Loading');
    expect(wrapper.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('adds and removes toast by calling action creators', function () {
    // action creators don't return anything
    addMessage('Loading', '', {duration: null});
    jest.runAllTimers();
    expect(wrapper.container).toHaveTextContent('Loading');

    // If no indicator is specified, will remove all indicators
    clearIndicators();
    jest.runAllTimers();
    expect(wrapper.container).toHaveTextContent('');
    expect(wrapper.queryByTestId('loading-indicator')).toBeNull();
  });

  it('adds and replaces toast by calling action creators', function () {
    addMessage('Loading', '', {duration: null});
    jest.runAllTimers();
    expect(wrapper.container).toHaveTextContent('Loading');

    // Old indicator gets replaced when a new one is added
    addMessage('success', 'success', {duration: null});
    jest.runAllTimers();
    expect(wrapper.container).toHaveTextContent('success');
    expect(wrapper.queryByTestId('loading-indicator')).toBeNull();
  });

  it('adds and replaces toasts by calling action creators helpers', async function () {
    // Old indicator gets replaced when a new one is added
    addSuccessMessage('success');

    await waitFor(() => {
      expect(wrapper.container).toHaveTextContent('success');
    });

    clearIndicators();
    addErrorMessage('error');
    await waitFor(() => {
      expect(wrapper.container).toHaveTextContent('error');
    });
  });

  it('appends toasts', function () {
    addMessage('Loading', '', {append: true, duration: null});
    jest.runAllTimers();
    expect(wrapper.getByTestId('toast')).toHaveTextContent('Loading');

    addMessage('Success', 'success', {append: true, duration: null});
    jest.runAllTimers();
    // Toasts get appended to the end
    expect(wrapper.getByTestId('toast')).toHaveTextContent('Loading');
    expect(wrapper.getByTestId('toast-success')).toHaveTextContent('Success');

    addMessage('Error', 'error', {append: true, duration: null});
    jest.runAllTimers();
    // Toasts get appended to the end
    expect(wrapper.getByTestId('toast')).toHaveTextContent('Loading');
    expect(wrapper.getByTestId('toast-success')).toHaveTextContent('Success');
    expect(wrapper.getByTestId('toast-error')).toHaveTextContent('Error');

    // clears all toasts
    clearIndicators();
    jest.runAllTimers();
    expect(wrapper.container).toHaveTextContent('');
    expect(wrapper.queryByTestId('loading-indicator')).toBeNull();
  });

  it('dismisses on click', function () {
    addMessage('Loading', '', {append: true, duration: null});
    jest.runAllTimers();
    expect(wrapper.getByTestId('toast')).toHaveTextContent('Loading');

    fireEvent.click(wrapper.getByTestId('toast'));
    jest.runAllTimers();
    expect(wrapper.container).toHaveTextContent('');
    expect(wrapper.queryByTestId('toast')).toBeNull();
  });

  it('hides after 10s', function () {
    addMessage('Duration', '', {append: true, duration: 10000});
    jest.advanceTimersByTime(9000);
    expect(wrapper.getByTestId('toast')).toHaveTextContent('Duration');

    // Still visible
    jest.advanceTimersByTime(999);
    expect(wrapper.getByTestId('toast')).toHaveTextContent('Duration');

    jest.advanceTimersByTime(2);
    expect(wrapper.container).toHaveTextContent('');
    expect(wrapper.queryByTestId('toast')).toBeNull();
  });
});
