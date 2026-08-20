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

  it('returns true when user has access without being a project member', () => {
    ProjectsStore.loadInitialData([ProjectFixture({hasAccess: true, isMember: false})]);

    const {result} = renderHookWithProviders(() => useHasProjectAccess());

    expect(result.current.hasProjectAccess).toBe(true);
  });

  it('returns false when the user has access to no project', () => {
    ProjectsStore.loadInitialData([ProjectFixture({hasAccess: false, isMember: false})]);

    const {result} = renderHookWithProviders(() => useHasProjectAccess());

    expect(result.current.hasProjectAccess).toBe(false);
  });

  // The API cannot return this combination: `has_access` is satisfied by
  // `is_member`, so membership always implies access. Asserted here to pin the
  // conservative behaviour if the serializer ever changes.
  it('returns false for a member of a project reported as inaccessible', () => {
    ProjectsStore.loadInitialData([ProjectFixture({hasAccess: false, isMember: true})]);

    const {result} = renderHookWithProviders(() => useHasProjectAccess());

    expect(result.current.hasProjectAccess).toBe(false);
  });

  it('returns true for superusers with access but no membership', () => {
    ConfigStore.set('user', {...ConfigStore.get('user'), isSuperuser: true});
    ProjectsStore.loadInitialData([ProjectFixture({hasAccess: true, isMember: false})]);

    const {result} = renderHookWithProviders(() => useHasProjectAccess());

    expect(result.current.hasProjectAccess).toBe(true);
  });

  it('superusers need membership when superuserNeedsToBeProjectMember', () => {
    ConfigStore.set('user', {...ConfigStore.get('user'), isSuperuser: true});
    ProjectsStore.loadInitialData([ProjectFixture({hasAccess: true, isMember: false})]);

    const {result} = renderHookWithProviders(() =>
      useHasProjectAccess({superuserNeedsToBeProjectMember: true})
    );

    expect(result.current.hasProjectAccess).toBe(false);
  });

  it('non-superusers need membership when superuserNeedsToBeProjectMember', () => {
    ProjectsStore.loadInitialData([ProjectFixture({hasAccess: true, isMember: false})]);

    const {result} = renderHookWithProviders(() =>
      useHasProjectAccess({superuserNeedsToBeProjectMember: true})
    );

    expect(result.current.hasProjectAccess).toBe(false);
  });
});
