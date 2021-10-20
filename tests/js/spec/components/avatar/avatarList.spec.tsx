import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import AvatarList from 'app/components/avatar/avatarList';

function renderComponent(avatarUsersSixUsers: AvatarList['props']['users']) {
  return mountWithTheme(<AvatarList users={avatarUsersSixUsers} />);
}

describe('AvatarList', () => {
  // @ts-expect-error
  const user = TestStubs.User();

  it('renders with user letter avatars', () => {
    const users = [
      {...user, id: '1', name: 'AB'},
      {...user, id: '2', name: 'BC'},
    ];

    const {container} = renderComponent(users);
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('B')).toBeTruthy();
    expect(screen.queryByTestId('avatarList-collapsedusers')).toBeNull();

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
    expect(screen.queryAllByText(users[0].name.charAt(0))).toBeTruthy();
    expect(screen.queryAllByText(users[1].name.charAt(0))).toBeTruthy();
    expect(screen.queryAllByText(users[2].name.charAt(0))).toBeTruthy();
    expect(screen.queryAllByText(users[3].name.charAt(0))).toBeTruthy();
    expect(screen.queryAllByText(users[4].name.charAt(0))).toBeTruthy();
    expect(screen.queryByText(users[5].name.charAt(0))).toBeNull();
    expect(screen.getByTestId('avatarList-collapsedusers')).toBeTruthy();
    expect(container).toSnapshot();
  });
});
