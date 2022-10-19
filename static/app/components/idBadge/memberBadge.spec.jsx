import {render, screen} from 'sentry-test/reactTestingLibrary';

import MemberBadge from 'sentry/components/idBadge/memberBadge';

describe('MemberBadge', function () {
  let member;
  beforeEach(() => {
    member = TestStubs.Member();
  });

  it('renders with link when member and orgId are supplied', function () {
    render(<MemberBadge member={member} orgId="orgId" />);

    expect(screen.getByTestId('letter_avatar-avatar')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Foo Bar'})).toBeInTheDocument();
    expect(screen.getByText('foo@example.com')).toBeInTheDocument();
  });

  it('does not use a link when useLink = false', function () {
    render(<MemberBadge member={member} useLink={false} orgId="orgId" />);

    expect(screen.queryByRole('link', {name: 'Foo Bar'})).not.toBeInTheDocument();
    expect(screen.getByText('Foo Bar')).toBeInTheDocument();
  });

  it('does not use a link when orgId = null', function () {
    render(<MemberBadge member={member} useLink />);

    expect(screen.queryByRole('link', {name: 'Foo Bar'})).not.toBeInTheDocument();
    expect(screen.getByText('Foo Bar')).toBeInTheDocument();
  });

  it('can display alternate display names/emails', function () {
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

  it('can coalesce using username', function () {
    member.user = TestStubs.User({
      name: null,
      email: null,
      username: 'the-batman',
    });

    render(<MemberBadge member={member} />);

    expect(screen.getByText('the-batman')).toBeInTheDocument();
  });

  it('can coalesce using ipaddress', function () {
    member.user = TestStubs.User({
      name: null,
      email: null,
      username: null,
      ipAddress: '127.0.0.1',
    });
    render(<MemberBadge member={member} />);

    expect(screen.getByText('127.0.0.1')).toBeInTheDocument();
  });

  it('can hide email address', function () {
    render(<MemberBadge member={member} hideEmail />);

    expect(screen.queryByText('foo@example.com')).not.toBeInTheDocument();
  });

  it('renders when a member without a user to passed to member', function () {
    render(<MemberBadge member={{...member, user: null}} />);

    expect(screen.getByTestId('letter_avatar-avatar')).toBeInTheDocument();
    expect(screen.getByText('Sentry 1 Name')).toBeInTheDocument();
  });
});
