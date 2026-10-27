import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {UserBadge} from 'sentry/components/idBadge/userBadge';
import type {AvatarUser} from 'sentry/types/user';

describe('UserBadge', () => {
  const user: AvatarUser = UserFixture();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([false, true])(
    'reveals the displayed email only when truncated (overflowing: %s)',
    async overflowing => {
      jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(100);
      jest
        .spyOn(Element.prototype, 'scrollWidth', 'get')
        .mockReturnValue(overflowing ? 200 : 50);

      const displayEmail = 'long-display-email@example.com';
      render(<UserBadge user={user} displayEmail={displayEmail} />);

      const email = screen.getByText(displayEmail);
      await userEvent.hover(email);

      if (overflowing) {
        await waitFor(() => expect(email).toHaveAccessibleDescription(displayEmail));
        expect(email).toHaveAttribute('tabindex', '0');
      } else {
        expect(email).not.toHaveAttribute('aria-describedby');
        expect(email).not.toHaveAttribute('tabindex');
      }
    }
  );

  it('renders with no link when user is supplied', () => {
    render(<UserBadge user={user} />);

    expect(screen.getByText('Foo Bar')).toBeInTheDocument();
    expect(screen.getByText('foo@example.com')).toBeInTheDocument();
  });

  it('can display alternate display names/emails', () => {
    render(
      <UserBadge
        user={user}
        displayName="Other Display Name"
        displayEmail="Other Display Email"
      />
    );

    expect(screen.getByText('Other Display Name')).toBeInTheDocument();
    expect(screen.getByText('Other Display Email')).toBeInTheDocument();
  });

  it('can coalesce using username', () => {
    const username = UserFixture({
      name: undefined,
      email: undefined,
      username: 'the-batman',
    });
    render(<UserBadge user={username} />);

    expect(screen.getByText(username.username)).toBeInTheDocument();
  });

  it('can coalesce using ipaddress', () => {
    const ipUser = UserFixture({
      name: undefined,
      email: undefined,
      username: undefined,
      ip_address: undefined,
      ipAddress: '127.0.0.1',
    });
    render(<UserBadge user={ipUser} />);

    expect(screen.getByText('127.0.0.1')).toBeInTheDocument();
  });

  it('can coalesce using id', () => {
    const idUser = UserFixture({
      id: '99',
      name: undefined,
      email: undefined,
      username: undefined,
      ip_address: undefined,
      ipAddress: undefined,
    });
    render(<UserBadge user={idUser} />);

    expect(screen.getByText(idUser.id)).toBeInTheDocument();
  });

  it('can hide email address', () => {
    render(<UserBadge user={user} hideEmail />);
    expect(screen.queryByText(user.email)).not.toBeInTheDocument();
  });

  it('can coalesce using ip', () => {
    const ipUser = UserFixture({
      name: undefined,
      email: undefined,
      username: undefined,
      ip: '127.0.0.1',
    });
    render(<UserBadge user={ipUser} />);

    expect(screen.getByText('127.0.0.1')).toBeInTheDocument();
  });
});
