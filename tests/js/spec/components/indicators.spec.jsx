import {
  act,
  mountWithTheme,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {
  addErrorMessage,
  addMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import Indicators from 'sentry/components/indicators';
import IndicatorStore from 'sentry/stores/indicatorStore';

// Make sure we use `duration: null` to test add/remove
jest.useFakeTimers();

jest.mock('framer-motion', () => ({
  ...jest.requireActual('framer-motion'),
  AnimatePresence: jest.fn(({children}) => children),
}));

describe('Indicators', function () {
  let wrapper;

  beforeEach(function () {
    wrapper = mountWithTheme(<Indicators />);

    clearIndicators();
    act(jest.runAllTimers);
  });

  it('renders nothing by default', function () {
    expect(wrapper.container).toHaveTextContent('');
  });

  it('has a loading indicator by default', function () {
    // when "type" is empty, we should treat it as loading state
    act(() => void IndicatorStore.add('Loading'));
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(wrapper.container).toHaveTextContent('Loading');
  });

  it('adds and removes a toast by calling IndicatorStore directly', function () {
    // when "type" is empty, we should treat it as loading state
    let indicator;
    act(() => {
      indicator = IndicatorStore.add('Loading');
    });

    expect(wrapper.container).toHaveTextContent('Loading');

    // Old indicator gets replaced when a new one is added
    act(() => IndicatorStore.remove(indicator));
    expect(wrapper.container).toHaveTextContent('');
  });

  // This is a common pattern used throughout the code for API calls
  it('adds and replaces toast by calling IndicatorStore directly', function () {
    act(() => void IndicatorStore.add('Loading'));
    expect(wrapper.container).toHaveTextContent('Loading');

    // Old indicator gets replaced when a new one is added
    act(() => void IndicatorStore.add('success', 'success'));
    expect(wrapper.container).toHaveTextContent('success');
  });

  it('does not have loading indicator when "type" is empty (default)', function () {
    addMessage('Loading', '', {duration: null});
    act(jest.runAllTimers);
    expect(wrapper.container).toHaveTextContent('Loading');
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  it('has a loading indicator when type is "loading"', function () {
    addMessage('Loading', 'loading', {duration: null});
    act(jest.runAllTimers);
    expect(wrapper.container).toHaveTextContent('Loading');
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('adds and removes toast by calling action creators', function () {
    // action creators don't return anything
    addMessage('Loading', '', {duration: null});
    act(jest.runAllTimers);
    expect(wrapper.container).toHaveTextContent('Loading');

    // If no indicator is specified, will remove all indicators
    clearIndicators();
    act(jest.runAllTimers);
    expect(wrapper.container).toHaveTextContent('');
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  it('adds and replaces toast by calling action creators', function () {
    addMessage('Loading', '', {duration: null});
    act(jest.runAllTimers);
    expect(wrapper.container).toHaveTextContent('Loading');

    // Old indicator gets replaced when a new one is added
    addMessage('success', 'success', {duration: null});
    act(jest.runAllTimers);
    expect(wrapper.container).toHaveTextContent('success');
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
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
    act(jest.runAllTimers);
    expect(screen.getByTestId('toast')).toHaveTextContent('Loading');

    addMessage('Success', 'success', {append: true, duration: null});
    act(jest.runAllTimers);
    // Toasts get appended to the end
    expect(screen.getByTestId('toast')).toHaveTextContent('Loading');
    expect(screen.getByTestId('toast-success')).toHaveTextContent('Success');

    addMessage('Error', 'error', {append: true, duration: null});
    act(jest.runAllTimers);
    // Toasts get appended to the end
    expect(screen.getByTestId('toast')).toHaveTextContent('Loading');
    expect(screen.getByTestId('toast-success')).toHaveTextContent('Success');
    expect(screen.getByTestId('toast-error')).toHaveTextContent('Error');

    // clears all toasts
    clearIndicators();
    act(jest.runAllTimers);
    expect(wrapper.container).toHaveTextContent('');
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  it('dismisses on click', function () {
    addMessage('Loading', '', {append: true, duration: null});
    act(jest.runAllTimers);
    expect(screen.getByTestId('toast')).toHaveTextContent('Loading');

    userEvent.click(screen.getByTestId('toast'));
    act(jest.runAllTimers);
    expect(wrapper.container).toHaveTextContent('');
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('hides after 10s', function () {
    addMessage('Duration', '', {append: true, duration: 10000});
    act(() => jest.advanceTimersByTime(9000));
    expect(screen.getByTestId('toast')).toHaveTextContent('Duration');

    // Still visible
    act(() => jest.advanceTimersByTime(999));
    expect(screen.getByTestId('toast')).toHaveTextContent('Duration');

    act(() => jest.advanceTimersByTime(2));
    expect(wrapper.container).toHaveTextContent('');
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });
});
