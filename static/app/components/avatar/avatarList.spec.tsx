import {Team} from 'sentry-fixture/team';
import {User} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import AvatarList from 'sentry/components/avatar/avatarList';

function renderComponent({
  users,
  teams,
}: {
  users: React.ComponentProps<typeof AvatarList>['users'];
  teams?: React.ComponentProps<typeof AvatarList>['teams'];
}) {
  return render(<AvatarList users={users} teams={teams} />);
}

describe('AvatarList', () => {
  const user = User();
  const team = Team();

  it('renders with user letter avatars', () => {
    const users = [
      {...user, id: '1', name: 'AB'},
      {...user, id: '2', name: 'BC'},
    ];

    renderComponent({users});
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.queryByTestId('avatarList-collapsedavatars')).not.toBeInTheDocument();
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

    renderComponent({users});
    expect(screen.getByText(users[0].name.charAt(0))).toBeInTheDocument();
    expect(screen.getByText(users[1].name.charAt(0))).toBeInTheDocument();
    expect(screen.getByText(users[2].name.charAt(0))).toBeInTheDocument();
    expect(screen.getByText(users[3].name.charAt(0))).toBeInTheDocument();
    expect(screen.getByText(users[4].name.charAt(0))).toBeInTheDocument();
    expect(screen.queryByText(users[5].name.charAt(0))).not.toBeInTheDocument();
    expect(screen.getByTestId('avatarList-collapsedavatars')).toBeInTheDocument();
  });

  it('renders with team avatars', () => {
    const users = [
      {...user, id: '1', name: 'CD'},
      {...user, id: '2', name: 'DE'},
    ];
    const teams = [
      {...team, id: '1', name: 'A', slug: 'A', type: 'team'},
      {...team, id: '2', name: 'B', slug: 'B', type: 'team'},
    ];

    renderComponent({users, teams});
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.queryByTestId('avatarList-collapsedavatars')).not.toBeInTheDocument();
  });
});
