import {render, screen} from 'sentry-test/reactTestingLibrary';

import AvatarList from 'sentry/components/avatar/avatarList';

function renderComponent(
  avatarUsersSixUsers: React.ComponentProps<typeof AvatarList>['users']
) {
  return render(<AvatarList users={avatarUsersSixUsers} />);
}

describe('AvatarList', () => {
  const user = TestStubs.User();

  it('renders with user letter avatars', () => {
    const users = [
      {...user, id: '1', name: 'AB'},
      {...user, id: '2', name: 'BC'},
    ];

    const {container} = renderComponent(users);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.queryByTestId('avatarList-collapsedusers')).not.toBeInTheDocument();

    expect(container).toSnapshot();
  });

  it('renders with collapsed avatar count if > 5 users', () => {
    const users = [
      {...user, id: '1', name: 'AB'},
      {...user, id: '2', name: 'BC'},
      {...user, id: '3', name: 'CD'},
      {...user, id: '4', name: 'DE'},
      {...user, id: '5', name: 'EF'},
      {...user, id: '6', name: 'FG'},
    ];

    const {container} = renderComponent(users);
    expect(screen.getByText(users[0].name.charAt(0))).toBeInTheDocument();
    expect(screen.getByText(users[1].name.charAt(0))).toBeInTheDocument();
    expect(screen.getByText(users[2].name.charAt(0))).toBeInTheDocument();
    expect(screen.getByText(users[3].name.charAt(0))).toBeInTheDocument();
    expect(screen.getByText(users[4].name.charAt(0))).toBeInTheDocument();
    expect(screen.queryByText(users[5].name.charAt(0))).not.toBeInTheDocument();
    expect(screen.getByTestId('avatarList-collapsedusers')).toBeInTheDocument();
    expect(container).toSnapshot();
  });
});
