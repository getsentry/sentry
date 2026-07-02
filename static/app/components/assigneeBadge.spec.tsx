import {UserFixture} from 'sentry-fixture/user';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {AssigneeBadge} from 'sentry/components/assigneeBadge';

describe('AssigneeBadge', () => {
  it('renders a hydrated user avatar when available', () => {
    const user = UserFixture({
      id: '1',
      name: 'Jane Bloggs',
      email: 'jane@example.com',
      avatar: {
        avatarType: 'upload',
        avatarUrl: 'https://example.com/avatar.jpg',
        avatarUuid: '123',
      },
    });

    render(
      <AssigneeBadge
        assignedTo={{id: user.id, name: user.name, type: 'user'}}
        assignedUser={user}
      />
    );

    expect(
      within(screen.getByTestId('assigned-avatar')).getByRole('img')
    ).toHaveAttribute('src', 'https://example.com/avatar.jpg?s=120');
  });
});
