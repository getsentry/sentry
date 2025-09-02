import {TeamFixture} from 'sentry-fixture/team';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {TeamBadge} from 'sentry/components/idBadge/teamBadge';
import TeamStore from 'sentry/stores/teamStore';

describe('TeamBadge', () => {
  beforeEach(() => {
    TeamStore.init();
  });

  it('renders with Avatar and team name', () => {
    render(<TeamBadge team={TeamFixture()} />);
    expect(screen.getByTestId('letter_avatar-avatar')).toBeInTheDocument();
    expect(screen.getByText(/#team-slug/)).toBeInTheDocument();
  });

  it('listens for avatar changes from TeamStore', async () => {
    const team = TeamFixture();
    render(<TeamBadge team={team} />);

    act(() => {
      TeamStore.onUpdateSuccess(team.id, {
        ...team,
        slug: 'new-team-slug',
      });
    });

    expect(await screen.findByText(/#new-team-slug/)).toBeInTheDocument();
  });

  it('updates state from props', async () => {
    const team = TeamFixture();
    const {rerender} = render(<TeamBadge team={team} />);
    rerender(<TeamBadge team={TeamFixture({slug: 'new-team-slug'})} />);
    expect(await screen.findByText(/#new-team-slug/)).toBeInTheDocument();
  });
});
