import {act, mountWithTheme} from 'sentry-test/reactTestingLibrary';

import TeamStore from 'app/stores/teamStore';
import Teams from 'app/utils/teams';

describe('utils.teams', function () {
  const renderer = jest.fn(() => null);

  const createWrapper = props => mountWithTheme(<Teams {...props}>{renderer}</Teams>);

  beforeEach(function () {
    TeamStore.loadInitialData([
      TestStubs.Team({id: '1', slug: 'bar'}),
      TestStubs.Team({id: '2', slug: 'foo'}),
    ]);
    renderer.mockClear();
  });

  afterEach(async function () {
    act(() => void TeamStore.loadInitialData([]));
  });

  it('sends projects to children', function () {
    createWrapper();
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
