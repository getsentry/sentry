import {OAuthContextFixture} from 'sentry-fixture/oauth';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConsentActions} from './consentActions';

afterEach(() => {
  try {
    act(() => jest.runOnlyPendingTimers());
  } finally {
    jest.useRealTimers();
  }
});

it.each(['pointer', 'keyboard'])(
  'delays approval after the first %s interaction',
  async interaction => {
    jest.useFakeTimers();
    const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
    const onDeny = jest.fn();
    const {unmount} = render(
      <ConsentActions
        application={OAuthContextFixture().application}
        busy={false}
        canApprove
        disabled={false}
        onDeny={onDeny}
      />
    );
    const approve = screen.getByRole('button', {name: 'Authorize'});
    expect(approve).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Deny'})).toBeEnabled();

    act(() => jest.advanceTimersByTime(2000));
    expect(approve).toBeDisabled();

    if (interaction === 'pointer') {
      await user.hover(approve);
    } else {
      await user.keyboard('{Tab}');
    }

    act(() => jest.advanceTimersByTime(100));
    expect(approve).toHaveTextContent('Authorize (wait 0.9s)');

    act(() => jest.advanceTimersByTime(899));
    expect(approve).toBeDisabled();

    act(() => jest.advanceTimersByTime(1));
    expect(approve).toBeEnabled();
    unmount();
  }
);
