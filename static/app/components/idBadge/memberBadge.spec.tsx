import {MemberFixture} from 'sentry-fixture/member';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import MemberBadge from 'sentry/components/idBadge/memberBadge';

describe('MemberBadge', () => {
  let member!: ReturnType<typeof MemberFixture>;
  beforeEach(() => {
    member = MemberFixture();
  });

  it('renders with link when member and orgId are supplied', () => {
    render(<MemberBadge member={member} />);

    expect(screen.getByTestId('letter_avatar-avatar')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Foo Bar'})).toBeInTheDocument();
    expect(screen.getByText('foo@example.com')).toBeInTheDocument();
  });

  it('does not use a link when disableLink', () => {
    render(<MemberBadge member={member} disableLink />);

    expect(screen.queryByRole('link', {name: 'Foo Bar'})).not.toBeInTheDocument();
    expect(screen.getByText('Foo Bar')).toBeInTheDocument();
  });

  it('can display alternate display names/emails', () => {
    render(
      <MemberBadge
        member={member}
        displayName="Other Display Name"
        displayEmail="Other Display Email"
      />
    );

    expect(screen.getByTestId('letter_avatar-avatar')).toBeInTheDocument();
    expect(screen.getByText('Other Display Name')).toBeInTheDocument();
    expect(screen.getByText('Other Display Email')).toBeInTheDocument();
  });

  it('can coalesce using username', () => {
    member.user = UserFixture({
      name: undefined,
      email: undefined,
      username: 'the-batman',
    });

    render(<MemberBadge member={member} />);

    expect(screen.getByText('the-batman')).toBeInTheDocument();
  });

  it('can coalesce using ipaddress', () => {
    member.user = UserFixture({
      name: undefined,
      email: undefined,
      username: undefined,
      ipAddress: '127.0.0.1',
    });
    render(<MemberBadge member={member} />);

    expect(screen.getByText('127.0.0.1')).toBeInTheDocument();
  });

  it('can hide email address', () => {
    render(<MemberBadge member={member} hideEmail />);

    expect(screen.queryByText('foo@example.com')).not.toBeInTheDocument();
  });

  it('renders when a member without a user to passed to member', () => {
    render(<MemberBadge member={{...member, user: null}} />);

    expect(screen.getByTestId('letter_avatar-avatar')).toBeInTheDocument();
    expect(screen.getByText('Sentry 1 Name')).toBeInTheDocument();
  });
});
