import {GroupFixture} from 'sentry-fixture/group';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {TeamParticipant, UserParticipant} from 'sentry/types/group';
import PeopleSection from 'sentry/views/issueDetails/streamline/peopleSection';

describe('PeopleSection', () => {
  const group = GroupFixture();

  it('displays participants and viewers', async () => {
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

    const participantGroup = {
      ...group,
      participants: [...teams, ...users],
      seenBy: users,
    };

    render(<PeopleSection group={participantGroup} />);

    expect(await screen.findByText('participating')).toBeInTheDocument();
    expect(await screen.findByText('viewed')).toBeInTheDocument();
  });

  it('does not display anything if there are no participants or viewers', () => {
    render(<PeopleSection group={group} />);

    expect(screen.queryByText('participating')).not.toBeInTheDocument();
    expect(screen.queryByText('viewed')).not.toBeInTheDocument();
  });
});
