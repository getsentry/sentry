import {Team} from 'sentry-fixture/team';
import {User} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ParticipantList} from './participantList';

describe('ParticipantList', () => {
  const users = [
    User({id: '1', name: 'John Doe', email: 'john.doe@example.com'}),
    User({id: '2', name: 'Jane Doe', email: 'jane.doe@example.com'}),
  ];

  const teams = [
    Team({id: '1', slug: 'team-1', memberCount: 3}),
    Team({id: '2', slug: 'team-2', memberCount: 5}),
  ];

  it('expands and collapses the list when clicked', async () => {
    render(
      <ParticipantList teams={teams} users={users} description="Participants">
        Click Me
      </ParticipantList>
    );
    expect(screen.queryByText('#team-1')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('Click Me'));
    await waitFor(() => expect(screen.getByText('#team-1')).toBeVisible());

    expect(screen.getByText('Teams (2)')).toBeInTheDocument();
    expect(screen.getByText('Individuals (2)')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Click Me'));
    await waitFor(() => expect(screen.getByText('#team-1')).not.toBeVisible());
  });

  it('does not display section headers when there is only users or teams', async () => {
    render(
      <ParticipantList teams={[]} users={users} description="Participants">
        Click Me
      </ParticipantList>
    );
    await userEvent.click(screen.getByRole('button', {name: 'Click Me'}));
    await waitFor(() => expect(screen.getByText('John Doe')).toBeVisible());

    expect(screen.queryByText('Individuals (2)')).not.toBeInTheDocument();
  });
});
