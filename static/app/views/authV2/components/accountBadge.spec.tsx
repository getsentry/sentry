import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AccountBadge} from 'sentry/views/authV2/components/accountBadge';

describe('AccountBadge', () => {
  it('identifies the account and offers switching', async () => {
    const user = UserFixture({name: 'Jane Doe', email: 'jane@example.com'});
    const onSwitchAccount = jest.fn();

    const {rerender} = render(
      <AccountBadge user={user} onSwitchAccount={onSwitchAccount} />
    );

    expect(screen.getByText('Jane Doe')).toBeVisible();
    expect(screen.getByText('jane@example.com')).toBeVisible();
    await userEvent.click(screen.getByRole('button', {name: 'Switch account'}));

    expect(onSwitchAccount).toHaveBeenCalledTimes(1);
    rerender(
      <AccountBadge user={user} isSwitchingAccount onSwitchAccount={onSwitchAccount} />
    );

    expect(screen.getByText(user.email)).toBeVisible();
    expect(screen.getByRole('button', {name: 'Switch account'})).toBeDisabled();
  });
});
