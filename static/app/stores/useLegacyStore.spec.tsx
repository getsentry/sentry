import {TeamFixture} from 'sentry-fixture/team';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import TeamStore from 'sentry/stores/teamStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

describe('useLegacyStore', () => {
  const team = TeamFixture();

  beforeEach(() => void TeamStore.reset());

  it('should update on change to store', () => {
    const {result} = renderHook(useLegacyStore, {initialProps: TeamStore});

    expect(result.current.teams).toEqual([]);

    act(() => TeamStore.loadInitialData([team]));

    expect(result.current.teams).toEqual([team]);
  });
});
