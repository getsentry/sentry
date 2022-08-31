import {act, render} from 'sentry-test/reactTestingLibrary';

import TeamStore from 'sentry/stores/teamStore';
import Teams from 'sentry/utils/teams';

describe('utils.teams', function () {
  const renderer = jest.fn(() => null);

  beforeEach(function () {
    TeamStore.loadInitialData([
      TestStubs.Team({id: '1', slug: 'bar'}),
      TestStubs.Team({id: '2', slug: 'foo'}),
    ]);
    renderer.mockClear();
  });

  afterEach(function () {
    act(() => void TeamStore.loadInitialData([]));
  });

  it('sends projects to children', function () {
    render(<Teams>{renderer}</Teams>);

    expect(renderer).toHaveBeenCalledWith(
      expect.objectContaining({
        fetching: false,
        hasMore: null,
        fetchError: null,
        teams: [
          expect.objectContaining({
            id: '1',
            slug: 'bar',
          }),
          expect.objectContaining({
            id: '2',
            slug: 'foo',
          }),
        ],
      })
    );
  });
});
