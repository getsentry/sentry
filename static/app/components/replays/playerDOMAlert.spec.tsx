import {render, screen} from 'sentry-test/reactTestingLibrary';

import localStorage from 'sentry/utils/localStorage';

import PlayerDOMAlert from './playerDOMAlert';

jest.mock('sentry/utils/localStorage');

describe('PlayerDOMAlert', () => {
  it('should render the alert when local storage key is not set', () => {
    render(<PlayerDOMAlert />);

    expect(screen.getByTestId('player-dom-alert')).toBeVisible();
  });

  it('should not render the alert when the local storage key is set', () => {
    // @ts-expect-error
    localStorage.getItem.mockImplementationOnce(() => '1');
    render(<PlayerDOMAlert />);

    expect(screen.queryByTestId('player-dom-alert')).not.toBeInTheDocument();
  });

  it('should be dismissable', () => {
    render(<PlayerDOMAlert />);

    expect(screen.getByTestId('player-dom-alert')).toBeVisible();

    screen.getByLabelText('Close Alert').click();

    expect(screen.queryByTestId('player-dom-alert')).not.toBeInTheDocument();
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'replay-player-dom-alert-dismissed',
      '1'
    );
  });
});
