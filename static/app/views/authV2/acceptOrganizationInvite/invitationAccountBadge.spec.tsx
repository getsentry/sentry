import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {InvitationAccountBadge} from './invitationAccountBadge';

describe('InvitationAccountBadge', () => {
  it('identifies the account accepting the invitation and offers switching', async () => {
    const user = UserFixture({name: 'Jane Doe', email: 'jane@example.com'});
    const onSwitchAccount = jest.fn();

    const {rerender} = render(
      <InvitationAccountBadge user={user} onSwitchAccount={onSwitchAccount} />
    );

    expect(screen.getByText('Jane Doe')).toBeVisible();
    expect(screen.getByText('jane@example.com')).toBeVisible();
    await userEvent.click(screen.getByRole('button', {name: 'Switch account'}));

    expect(onSwitchAccount).toHaveBeenCalledTimes(1);
    rerender(
      <InvitationAccountBadge
        user={user}
        isSwitchingAccount
        onSwitchAccount={onSwitchAccount}
      />
    );

    expect(screen.getByText(user.email)).toBeVisible();
    expect(screen.getByRole('button', {name: 'Switch account'})).toBeDisabled();
  });
});
