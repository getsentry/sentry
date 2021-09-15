import {act, mountWithTheme} from 'sentry-test/reactTestingLibrary';

import TeamStore from 'app/stores/teamStore';
import {useLegacyStore} from 'app/stores/useLegacyStore';

describe('useLegacyStore', () => {
  // @ts-expect-error
  const team = TestStubs.Team();

  function TestComponent() {
    const teamStore = useLegacyStore(TeamStore);
    return <div>Teams: {teamStore.teams.length}</div>;
  }

  afterEach(() => {
    TeamStore.reset();
  });

  it('should update on change to store', () => {
    const wrapper = mountWithTheme(<TestComponent />);
    expect(wrapper.getByText('Teams: 0')).toBeTruthy();

    act(() => TeamStore.loadInitialData([team]));

    expect(wrapper.getByText('Teams: 1')).toBeTruthy();
  });
});
