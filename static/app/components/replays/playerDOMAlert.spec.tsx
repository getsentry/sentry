import {render, screen} from 'sentry-test/reactTestingLibrary';

import localStorage from 'sentry/utils/localStorage';

import PlayerDOMAlert from './playerDOMAlert';

jest.mock('sentry/utils/localStorage');
jest.useFakeTimers();

const mockGetItem = jest.mocked(localStorage.getItem);

const now = new Date('2020-01-01');
jest.setSystemTime(now);

describe('PlayerDOMAlert', () => {
  beforeEach(() => {
    mockGetItem.mockReset();
  });

  it('should render the alert when local storage key is not set', () => {
    render(<PlayerDOMAlert />);

    expect(screen.getByTestId('player-dom-alert')).toBeVisible();
  });

  it('should not render the alert when the local storage key is set', () => {
    mockGetItem.mockImplementationOnce(() => now.getTime().toString());
    render(<PlayerDOMAlert />);

    expect(screen.queryByTestId('player-dom-alert')).not.toBeInTheDocument();
  });

  it('should be dismissable', () => {
    render(<PlayerDOMAlert />);

    expect(screen.getByTestId('player-dom-alert')).toBeVisible();

    screen.getByLabelText('Close Alert').click();
    jest.runAllTicks();

    expect(screen.queryByTestId('player-dom-alert')).not.toBeInTheDocument();
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'replay-player-dom-alert-dismissed',
      '"1577836800000"'
    );
  });
});
