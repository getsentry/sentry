import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import localStorageWrapper from 'sentry/utils/localStorage';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';

describe('useSyncedLocalStorageState', function () {
  beforeEach(() => {
    localStorageWrapper.clear();
  });

  function Toggle() {
    const [value, setValue] = useSyncedLocalStorageState<boolean>('key', false);

    return <button onClick={() => setValue(!value)}>{value ? 'On' : 'Off'}</button>;
  }

  function Text() {
    const [value] = useSyncedLocalStorageState<boolean>('key', false);

    return <div>{value ? 'Value is on' : 'Value is off'}</div>;
  }

  it('responds to changes in multiple components', async function () {
    localStorageWrapper.setItem('key', 'true');

    function TestComponent() {
      return (
        <div>
          <Toggle />
          <Text />
        </div>
      );
    }

    render(<TestComponent />);

    // Both components should be 'On' initially due to setItem above
    expect(screen.getByRole('button', {name: 'On'})).toBeInTheDocument();
    expect(screen.getByText('Value is on')).toBeInTheDocument();

    // After clicking the button, they both should be 'Off'
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button', {name: 'Off'})).toBeInTheDocument();
    expect(screen.getByText('Value is off')).toBeInTheDocument();

    // localStorage should eventually have the value of false
    await waitFor(() => {
      expect(localStorageWrapper.getItem('key')).toBe('false');
    });
  });
});
