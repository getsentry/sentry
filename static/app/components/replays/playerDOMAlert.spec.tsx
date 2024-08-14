import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import localStorage from 'sentry/utils/localStorage';

import PlayerDOMAlert from './playerDOMAlert';

jest.mock('sentry/utils/localStorage');

const mockGetItem = jest.mocked(localStorage.getItem);

const now = new Date('2020-01-01');

describe('PlayerDOMAlert', () => {
  beforeEach(() => {
    mockGetItem.mockReset();
    setMockDate(now);
  });
  afterEach(() => {
    resetMockDate();
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

  it('should be dismissable', async () => {
    render(<PlayerDOMAlert />);

    expect(screen.getByTestId('player-dom-alert')).toBeVisible();

    await userEvent.click(screen.getByLabelText('Close Alert'));

    expect(screen.queryByTestId('player-dom-alert')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'replay-player-dom-alert-dismissed',
        '"1577836800000"'
      )
    );
  });
});
