import {ProjectFixture} from 'sentry-fixture/project';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';

import {useHasProjectAccess} from './useHasProjectAccess';

describe('useHasProjectAccess', () => {
  beforeEach(() => {
    ProjectsStore.reset();
    ConfigStore.set('user', {...ConfigStore.get('user'), isSuperuser: false});
  });

  it('returns false when there are no projects', () => {
    ProjectsStore.loadInitialData([]);

    const {result} = renderHookWithProviders(() => useHasProjectAccess());

    expect(result.current.hasProjectAccess).toBe(false);
    expect(result.current.projectsLoaded).toBe(true);
  });

  it('returns true when user is a member of a project with access', () => {
    ProjectsStore.loadInitialData([ProjectFixture({hasAccess: true, isMember: true})]);

    const {result} = renderHookWithProviders(() => useHasProjectAccess());

    expect(result.current.hasProjectAccess).toBe(true);
  });
});
