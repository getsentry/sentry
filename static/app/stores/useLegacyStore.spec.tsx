import {Team} from 'sentry-fixture/team';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import TeamStore from 'sentry/stores/teamStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

describe('useLegacyStore', () => {
  const team = Team();

  beforeEach(() => void TeamStore.reset());

  it('should update on change to store', () => {
    const {result} = reactHooks.renderHook(useLegacyStore, {initialProps: TeamStore});

    expect(result.current.teams).toEqual([]);

    reactHooks.act(() => TeamStore.loadInitialData([team]));

    expect(result.current.teams).toEqual([team]);
  });
});
