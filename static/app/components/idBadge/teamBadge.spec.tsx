import {TeamFixture} from 'sentry-fixture/team';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {TeamBadge} from 'sentry/components/idBadge/teamBadge';
import TeamStore from 'sentry/stores/teamStore';

describe('TeamBadge', function () {
  beforeEach(() => {
    TeamStore.init();
  });

  it('renders with Avatar and team name', function () {
    render(<TeamBadge team={TeamFixture()} />);
    expect(screen.getByTestId('badge-styled-avatar')).toBeInTheDocument();
    expect(screen.getByText(/#team-slug/)).toBeInTheDocument();
  });

  it('listens for avatar changes from TeamStore', async function () {
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

  it('updates state from props', async function () {
    const team = TeamFixture();
    const {rerender} = render(<TeamBadge team={team} />);
    rerender(<TeamBadge team={TeamFixture({slug: 'new-team-slug'})} />);
    expect(await screen.findByText(/#new-team-slug/)).toBeInTheDocument();
  });
});
