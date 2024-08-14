import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import UserBadge from 'sentry/components/idBadge/userBadge';
import type {AvatarUser} from 'sentry/types/user';

describe('UserBadge', function () {
  const user: AvatarUser = UserFixture();

  it('renders with no link when user is supplied', function () {
    render(<UserBadge user={user} />);

    expect(screen.getByText('Foo Bar')).toBeInTheDocument();
    expect(screen.getByText('foo@example.com')).toBeInTheDocument();
  });

  it('can display alternate display names/emails', function () {
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

  it('can coalesce using username', function () {
    const username = UserFixture({
      name: undefined,
      email: undefined,
      username: 'the-batman',
    });
    render(<UserBadge user={username} />);

    expect(screen.getByText(username.username)).toBeInTheDocument();
  });

  it('can coalesce using ipaddress', function () {
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

  it('can coalesce using id', function () {
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

  it('can hide email address', function () {
    render(<UserBadge user={user} hideEmail />);
    expect(screen.queryByText(user.email)).not.toBeInTheDocument();
  });

  it('can coalesce using ip', function () {
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
