import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {TeamParticipant, UserParticipant} from 'sentry/types/group';
import PeopleSection from 'sentry/views/issueDetails/streamline/sidebar/peopleSection';

describe('PeopleSection', () => {
  const teams: TeamParticipant[] = [{...TeamFixture(), type: 'team'}];
  const users: UserParticipant[] = [
    {
      ...UserFixture({
        id: '2',
        name: 'John Smith',
        email: 'johnsmith@example.com',
      }),
      type: 'user',
    },
    {
      ...UserFixture({
        id: '3',
        name: 'Sohn Jmith',
        email: 'sohnjmith@example.com',
      }),
      type: 'user',
    },
  ];

  it('displays participants and viewers', async () => {
    render(
      <PeopleSection teamParticipants={teams} userParticipants={users} viewers={users} />
    );

    expect(await screen.findByText('participating')).toBeInTheDocument();
    expect(await screen.findByText('viewed')).toBeInTheDocument();
  });

  it('does not display particiapnts if there are none', () => {
    render(<PeopleSection teamParticipants={[]} userParticipants={[]} viewers={users} />);

    expect(screen.queryByText('participating')).not.toBeInTheDocument();
  });
});
