import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ParticipantList from 'sentry/views/issueDetails/streamline/sidebar/participantList';

describe('ParticipantList', () => {
  const users = [
    UserFixture({
      id: '1',
      name: 'John Doe',
      email: 'john.doe@example.com',
      lastSeen: '2024-01-01T00:00:00.000Z',
    }),
    UserFixture({
      id: '2',
      name: 'Bob Alice',
      email: 'bob.alice@example.com',
      lastSeen: '2024-01-02T00:00:00.000Z',
    }),
  ];

  const teams = [
    TeamFixture({id: '1', slug: 'team-1', memberCount: 3}),
    TeamFixture({id: '2', slug: 'team-2', memberCount: 5}),
  ];

  it('expands and collapses the list when clicked', async () => {
    render(<ParticipantList teams={teams} users={users} />);
    expect(screen.queryByText('#team-1')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('JD'), {skipHover: true});
    expect(await screen.findByText('#team-1')).toBeInTheDocument();
    expect(await screen.findByText('Bob Alice')).toBeInTheDocument();

    expect(screen.getByText('Teams (2)')).toBeInTheDocument();
    expect(screen.getByText('Individuals (2)')).toBeInTheDocument();

    await userEvent.click(screen.getAllByText('JD')[0]!, {skipHover: true});
    expect(screen.queryByText('Bob Alice')).not.toBeInTheDocument();
  });

  it('does not display section headers when there is only users or teams', async () => {
    render(<ParticipantList users={users} />);
    await userEvent.click(screen.getByText('JD'), {skipHover: true});
    expect(await screen.findByText('Bob Alice')).toBeInTheDocument();

    expect(screen.queryByText('Teams')).not.toBeInTheDocument();
  });

  it('skips duplicate information between name and email', async () => {
    const duplicateInfoUsers = [
      UserFixture({id: '1', name: 'john.doe@example.com', email: 'john.doe@example.com'}),
    ];
    render(<ParticipantList users={duplicateInfoUsers} />);
    await userEvent.click(screen.getByText('J'), {skipHover: true});
    // Would find two elements if it was duplicated
    expect(await screen.findByText('john.doe@example.com')).toBeInTheDocument();
  });

  it('displays information about last seen, if available', async () => {
    render(<ParticipantList users={users} teams={teams} />);
    await userEvent.click(screen.getByText('JD'), {skipHover: true});
    expect(await screen.findByText('John Doe')).toBeInTheDocument();
    expect(await screen.findByText('Jan 1, 2024 12:00 AM')).toBeInTheDocument();
    expect(await screen.findByText('Bob Alice')).toBeInTheDocument();
    expect(await screen.findByText('Jan 2, 2024 12:00 AM')).toBeInTheDocument();
    // Still display teams/users without timestamps
    expect(await screen.findByText('#team-1')).toBeInTheDocument();
    expect(await screen.findByText('#team-2')).toBeInTheDocument();
  });
});
