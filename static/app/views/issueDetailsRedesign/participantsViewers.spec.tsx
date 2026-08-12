import {GroupFixture} from 'sentry-fixture/group';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import type {UserParticipant} from 'sentry/types/group';

import {ParticipantsViewers} from './participantsViewers';

describe('ParticipantsViewers', () => {
  const activeUser = UserFixture({id: '1', name: 'Active User'});

  beforeEach(() => {
    ConfigStore.set('user', activeUser);
  });

  it('renders nothing when there are no participants or viewers', () => {
    const group = GroupFixture({participants: [], seenBy: []});
    const {container} = render(<ParticipantsViewers group={group} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows participants and viewers in the hover dropdown', async () => {
    const participant: UserParticipant = {
      ...UserFixture({id: '2', name: 'Adrian Bonilla', email: 'adrian@example.com'}),
      type: 'user',
    };
    const viewer = UserFixture({id: '3', name: 'Amir Khan', email: 'amir@example.com'});

    const group = GroupFixture({
      participants: [participant],
      // The active user is filtered out of the viewer list.
      seenBy: [viewer, activeUser],
    });

    render(<ParticipantsViewers group={group} />);

    await userEvent.hover(screen.getByLabelText('Participants and viewers'));

    expect(await screen.findByText('Participants')).toBeInTheDocument();
    expect(screen.getByText('Viewers')).toBeInTheDocument();
    expect(screen.getByText('Adrian Bonilla')).toBeInTheDocument();
    expect(screen.getByText('Amir Khan')).toBeInTheDocument();
    // The active user should not appear as a viewer of their own issue.
    expect(screen.queryByText('Active User')).not.toBeInTheDocument();
  });
});
