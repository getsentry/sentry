import {ProjectFixture} from 'sentry-fixture/project';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';

import {useHasProjectAccess} from './useHasProjectAccess';

function setSuperuser(isSuperuser: boolean) {
  ConfigStore.set('user', {...ConfigStore.get('user'), isSuperuser});
}

describe('useHasProjectAccess', () => {
  beforeEach(() => {
    ProjectsStore.reset();
    setSuperuser(false);
  });

  it('returns false when there are no projects', () => {
    ProjectsStore.loadInitialData([]);

    const {result} = renderHookWithProviders(() => useHasProjectAccess());

    expect(result.current.hasProjectAccess).toBe(false);
    expect(result.current.projectsLoaded).toBe(true);
  });

  describe('regular users', () => {
    it('returns true when the user is a member of a project with access', () => {
      setSuperuser(false);
      ProjectsStore.loadInitialData([ProjectFixture({hasAccess: true, isMember: true})]);

      const {result} = renderHookWithProviders(() => useHasProjectAccess());

      expect(result.current.hasProjectAccess).toBe(true);
    });

    it('returns true when the user has access without being a project member', () => {
      setSuperuser(false);
      ProjectsStore.loadInitialData([ProjectFixture({hasAccess: true, isMember: false})]);

      const {result} = renderHookWithProviders(() => useHasProjectAccess());

      expect(result.current.hasProjectAccess).toBe(true);
    });

    it('returns false when the user has access to no project', () => {
      setSuperuser(false);
      ProjectsStore.loadInitialData([
        ProjectFixture({hasAccess: false, isMember: false}),
      ]);

      const {result} = renderHookWithProviders(() => useHasProjectAccess());

      expect(result.current.hasProjectAccess).toBe(false);
    });

    // The API cannot return this combination: `has_access` is satisfied by
    // `is_member`, so membership always implies access. Asserted here to pin the
    // conservative behaviour if the serializer ever changes.
    it('returns false for a member of a project reported as inaccessible', () => {
      setSuperuser(false);
      ProjectsStore.loadInitialData([ProjectFixture({hasAccess: false, isMember: true})]);

      const {result} = renderHookWithProviders(() => useHasProjectAccess());

      expect(result.current.hasProjectAccess).toBe(false);
    });

    it('is unaffected by superuserNeedsToBeProjectMember', () => {
      setSuperuser(false);
      ProjectsStore.loadInitialData([ProjectFixture({hasAccess: true, isMember: false})]);

      const {result} = renderHookWithProviders(() =>
        useHasProjectAccess({superuserNeedsToBeProjectMember: true})
      );

      expect(result.current.hasProjectAccess).toBe(true);
    });

    it('needs membership when requireProjectMembership is set', () => {
      setSuperuser(false);
      ProjectsStore.loadInitialData([ProjectFixture({hasAccess: true, isMember: false})]);

      const {result} = renderHookWithProviders(() =>
        useHasProjectAccess({requireProjectMembership: true})
      );

      expect(result.current.hasProjectAccess).toBe(false);
    });

    it('returns true for a member when requireProjectMembership is set', () => {
      setSuperuser(false);
      ProjectsStore.loadInitialData([ProjectFixture({hasAccess: true, isMember: true})]);

      const {result} = renderHookWithProviders(() =>
        useHasProjectAccess({requireProjectMembership: true})
      );

      expect(result.current.hasProjectAccess).toBe(true);
    });
  });

  describe('superusers', () => {
    it('returns true with access but no membership', () => {
      setSuperuser(true);
      ProjectsStore.loadInitialData([ProjectFixture({hasAccess: true, isMember: false})]);

      const {result} = renderHookWithProviders(() => useHasProjectAccess());

      expect(result.current.hasProjectAccess).toBe(true);
    });

    it('needs membership when superuserNeedsToBeProjectMember is set', () => {
      setSuperuser(true);
      ProjectsStore.loadInitialData([ProjectFixture({hasAccess: true, isMember: false})]);

      const {result} = renderHookWithProviders(() =>
        useHasProjectAccess({superuserNeedsToBeProjectMember: true})
      );

      expect(result.current.hasProjectAccess).toBe(false);
    });

    it('returns true when a member and superuserNeedsToBeProjectMember is set', () => {
      setSuperuser(true);
      ProjectsStore.loadInitialData([ProjectFixture({hasAccess: true, isMember: true})]);

      const {result} = renderHookWithProviders(() =>
        useHasProjectAccess({superuserNeedsToBeProjectMember: true})
      );

      expect(result.current.hasProjectAccess).toBe(true);
    });

    it('needs membership when requireProjectMembership is set', () => {
      setSuperuser(true);
      ProjectsStore.loadInitialData([ProjectFixture({hasAccess: true, isMember: false})]);

      const {result} = renderHookWithProviders(() =>
        useHasProjectAccess({requireProjectMembership: true})
      );

      expect(result.current.hasProjectAccess).toBe(false);
    });
  });
});
