import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  addErrorMessage,
  addMessage,
  addSuccessMessage,
  clearIndicators,
  type Indicator,
} from 'sentry/actionCreators/indicator';
import Indicators from 'sentry/components/indicators';
import IndicatorStore from 'sentry/stores/indicatorStore';

// Make sure we use `duration: null` to test add/remove

jest.mock('framer-motion', () => ({
  ...jest.requireActual('framer-motion'),
  AnimatePresence: jest.fn(({children}) => children),
}));

describe('Indicators', function () {
  beforeEach(function () {
    act(() => clearIndicators());
  });

  it('renders nothing by default', function () {
    const {container} = render(<Indicators />);
    expect(container).toHaveTextContent('');
  });

  it('has a loading indicator by default', function () {
    const {container} = render(<Indicators />);
    // when "type" is empty, we should treat it as loading state

    act(() => void IndicatorStore.add('Loading'));
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(container).toHaveTextContent('Loading');
  });

  it('adds and removes a toast by calling IndicatorStore directly', function () {
    const {container} = render(<Indicators />);

    // when "type" is empty, we should treat it as loading state
    let indicator!: Indicator;
    act(() => {
      indicator = IndicatorStore.add('Loading');
    });

    expect(container).toHaveTextContent('Loading');

    // Old indicator gets replaced when a new one is added
    act(() => IndicatorStore.remove(indicator));
    expect(container).toHaveTextContent('');
  });

  // This is a common pattern used throughout the code for API calls
  it('adds and replaces toast by calling IndicatorStore directly', function () {
    const {container} = render(<Indicators />);

    act(() => void IndicatorStore.add('Loading'));
    expect(container).toHaveTextContent('Loading');

    // Old indicator gets replaced when a new one is added
    act(() => void IndicatorStore.add('success', 'success'));
    expect(container).toHaveTextContent('success');
  });

  it('does not have loading indicator when "type" is empty (default)', function () {
    const {container} = render(<Indicators />);

    act(() => addMessage('Loading', '', {duration: null}));
    expect(container).toHaveTextContent('Loading');
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  it('has a loading indicator when type is "loading"', function () {
    const {container} = render(<Indicators />);

    act(() => addMessage('Loading', 'loading', {duration: null}));
    expect(container).toHaveTextContent('Loading');
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('adds and removes toast by calling action creators', function () {
    const {container} = render(<Indicators />);

    // action creators don't return anything
    act(() => addMessage('Loading', '', {duration: null}));
    expect(container).toHaveTextContent('Loading');

    // If no indicator is specified, will remove all indicators
    act(() => clearIndicators());
    expect(container).toHaveTextContent('');
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  it('adds and replaces toast by calling action creators', function () {
    const {container} = render(<Indicators />);

    act(() => addMessage('Loading', '', {duration: null}));
    expect(container).toHaveTextContent('Loading');

    // Old indicator gets replaced when a new one is added
    act(() => addMessage('success', 'success', {duration: null}));
    expect(container).toHaveTextContent('success');
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  it('adds and replaces toasts by calling action creators helpers', async function () {
    const {container} = render(<Indicators />);

    // Old indicator gets replaced when a new one is added
    act(() => addSuccessMessage('success'));

    await waitFor(() => {
      expect(container).toHaveTextContent('success');
    });

    act(() => clearIndicators());
    act(() => addErrorMessage('error'));
    await waitFor(() => {
      expect(container).toHaveTextContent('error');
    });
  });

  it('appends toasts', function () {
    const {container} = render(<Indicators />);

    act(() => addMessage('Loading', '', {append: true, duration: null}));
    expect(screen.getByTestId('toast')).toHaveTextContent('Loading');

    act(() => addMessage('Success', 'success', {append: true, duration: null}));
    // Toasts get appended to the end
    expect(screen.getByTestId('toast')).toHaveTextContent('Loading');
    expect(screen.getByTestId('toast-success')).toHaveTextContent('Success');

    act(() => addMessage('Error', 'error', {append: true, duration: null}));
    // Toasts get appended to the end
    expect(screen.getByTestId('toast')).toHaveTextContent('Loading');
    expect(screen.getByTestId('toast-success')).toHaveTextContent('Success');
    expect(screen.getByTestId('toast-error')).toHaveTextContent('Error');

    // clears all toasts
    act(() => clearIndicators());
    expect(container).toHaveTextContent('');
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  it('dismisses on click', async function () {
    const {container} = render(<Indicators />);

    act(() => addMessage('Loading', '', {append: true, duration: null}));
    expect(screen.getByTestId('toast')).toHaveTextContent('Loading');

    await userEvent.click(screen.getByTestId('toast'));
    expect(container).toHaveTextContent('');
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('hides after 10s', function () {
    jest.useFakeTimers();
    const {container} = render(<Indicators />);

    act(() => addMessage('Duration', '', {append: true, duration: 10000}));
    act(() => jest.advanceTimersByTime(9000));
    expect(screen.getByTestId('toast')).toHaveTextContent('Duration');

    // Still visible
    act(() => jest.advanceTimersByTime(999));
    expect(screen.getByTestId('toast')).toHaveTextContent('Duration');

    act(() => jest.advanceTimersByTime(2));
    expect(container).toHaveTextContent('');
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
    jest.useRealTimers();
  });
});
