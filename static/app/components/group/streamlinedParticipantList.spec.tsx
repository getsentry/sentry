import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ParticipantList from 'sentry/components/group/streamlinedParticipantList';

describe('ParticipantList', () => {
  const users = [
    UserFixture({id: '1', name: 'John Doe', email: 'john.doe@example.com'}),
    UserFixture({id: '2', name: 'Bob Alice', email: 'bob.alice@example.com'}),
  ];

  const teams = [
    TeamFixture({id: '1', slug: 'team-1', memberCount: 3}),
    TeamFixture({id: '2', slug: 'team-2', memberCount: 5}),
  ];

  it('expands and collapses the list when clicked', async () => {
    render(<ParticipantList teams={teams} users={users} />);
    expect(screen.queryByText('#team-1')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('JD'));
    expect(await screen.findByText('#team-1')).toBeInTheDocument();
    expect(await screen.findByText('Bob Alice')).toBeInTheDocument();

    expect(screen.getByText('Teams (2)')).toBeInTheDocument();
    expect(screen.getByText('Individuals (2)')).toBeInTheDocument();

    await userEvent.click(screen.getAllByText('JD')[0]);
    expect(screen.queryByText('Bob Alice')).not.toBeInTheDocument();
  });

  it('does not display section headers when there is only users or teams', async () => {
    render(<ParticipantList users={users} />);
    await userEvent.click(screen.getByText('JD'));
    expect(await screen.findByText('Bob Alice')).toBeInTheDocument();

    expect(screen.queryByText('Teams')).not.toBeInTheDocument();
  });
});
