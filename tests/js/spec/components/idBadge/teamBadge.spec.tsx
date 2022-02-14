import {act, mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import {TeamBadge} from 'sentry/components/idBadge/teamBadge';
import TeamStore from 'sentry/stores/teamStore';

describe('TeamBadge', function () {
  beforeEach(() => {
    TeamStore.init();
  });

  it('renders with Avatar and team name', function () {
    mountWithTheme(<TeamBadge team={TestStubs.Team()} />);
    expect(screen.getByTestId('badge-styled-avatar')).toBeInTheDocument();
    expect(screen.getByText(/#team-slug/)).toBeInTheDocument();
  });

  it('listens for avatar changes from TeamStore', async function () {
    const team = TestStubs.Team();
    mountWithTheme(<TeamBadge team={team} />);

    act(() => {
      TeamStore.onUpdateSuccess(team.id, {
        ...team,
        slug: 'new-team-slug',
      });
    });

    expect(await screen.findByText(/#new-team-slug/)).toBeInTheDocument();
  });

  it('updates state from props', async function () {
    const team = TestStubs.Team();
    const {rerender} = mountWithTheme(<TeamBadge team={team} />);

    rerender(<TeamBadge team={TestStubs.Team({slug: 'new-team-slug'})} />);

    expect(await screen.findByText(/#new-team-slug/)).toBeInTheDocument();
  });
});
