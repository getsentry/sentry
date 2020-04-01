import React from 'react';
import {render} from '@testing-library/react';

import AvatarList from 'app/components/avatar/avatarList';
import {AvatarUser} from 'app/types';

const avatarUsers: Array<AvatarUser> = [
  {
    id: '1',
    name: 'Jan',
    username: 'jan_sentry',
    email: 'jan_sentry@gmail.com',
    ip_address: '12.31.20.11',
  },
  {
    id: '2',
    name: 'Daniel',
    username: 'daniel_sentry',
    email: 'daniel_sentry@gmail.com',
    ip_address: '12.31.20.12',
  },
];

function renderComponent(avatarUsersSixUsers: AvatarList['props']['users']) {
  const utils = render(<AvatarList users={avatarUsersSixUsers} />);
  return {...utils};
}

describe('AvatarList', () => {
  it('renders with user letter avatars', () => {
    const {container, queryByTestId, getByText} = renderComponent(avatarUsers);
    expect(getByText('D')).toBeTruthy();
    expect(getByText('J')).toBeTruthy();
    expect(queryByTestId('avatarList-collapsedusers')).toBeNull();
    // too get the root element of your rendered element, use container.firstChild
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders with collapsed avatar count if > 5 users', () => {
    const avatarUsersSixUsers = [
      ...avatarUsers,
      {
        id: '3',
        name: 'Matej',
        username: 'matej_sentry',
        email: 'matej_sentry@gmail.com',
        ip_address: '12.31.20.13',
      },
      {
        id: '4',
        name: 'Billy',
        username: 'billy_sentry',
        email: 'jbilly_sentry@gmail.com',
        ip_address: '12.31.20.14',
      },
      {
        id: '5',
        name: 'Mark',
        username: 'mark_sentry',
        email: 'mark_sentry@gmail.com',
        ip_address: '12.31.20.15',
      },
      {
        id: '6',
        name: 'Alberto',
        username: 'alberto_sentry',
        email: 'alberto_sentry@gmail.com',
        ip_address: '12.31.20.16',
      },
    ];

    const {container, getByTestId, queryByText, queryAllByText} = renderComponent(
      avatarUsersSixUsers
    );
    expect(queryAllByText(avatarUsersSixUsers[4].name.charAt(0))).toBeTruthy();
    expect(queryByText(avatarUsersSixUsers[3].name.charAt(0))).toBeTruthy();
    expect(queryByText(avatarUsersSixUsers[5].name.charAt(0))).toBeNull();
    expect(getByTestId('avatarList-collapsedusers')).toBeTruthy();
    expect(container.firstChild).toMatchSnapshot();
  });
});
