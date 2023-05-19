import type {PlatformKey} from 'sentry/data/platformCategories';
import type {MinimalProject} from 'sentry/types';
import projectSupportsReplay, {
  projectCanLinkToReplay,
} from 'sentry/utils/replays/projectSupportsReplay';

function mockProject(platform: PlatformKey): MinimalProject {
  return {
    id: '1',
    slug: 'test-project',
    platform,
  };
}

describe('projectSupportsReplay & projectCanLinkToReplay', () => {
  it.each([
    'javascript-angular' as PlatformKey,
    'javascript-nextjs' as PlatformKey,
    'javascript-react' as PlatformKey,
    'javascript' as PlatformKey,
  ])('should SUPPORT & LINK frontend platform %s', platform => {
    const project = mockProject(platform);
    expect(projectSupportsReplay(project)).toBeTruthy();
    expect(projectCanLinkToReplay(project)).toBeTruthy();
  });

  it.each(['javascript-angularjs' as PlatformKey])(
    'should FAIL for old, unsupported frontend framework %s',
    platform => {
      const project = mockProject(platform);
      expect(projectSupportsReplay(project)).toBeFalsy();
      expect(projectCanLinkToReplay(project)).toBeFalsy();
    }
  );

  it.each([
    'dotnet' as PlatformKey,
    'java' as PlatformKey,
    'node' as PlatformKey,
    'php' as PlatformKey,
    'rust' as PlatformKey,
  ])('should NOT SUPPORT but CAN LINK for Backend framework %s', platform => {
    const project = mockProject(platform);
    expect(projectSupportsReplay(project)).toBeFalsy();
    expect(projectCanLinkToReplay(project)).toBeTruthy();
  });

  it.each([
    'apple-macos' as PlatformKey,
    'electron' as PlatformKey,
    'flutter' as PlatformKey,
    'unity' as PlatformKey,
  ])('should FAIL for Desktop framework %s', platform => {
    const project = mockProject(platform);
    expect(projectSupportsReplay(project)).toBeFalsy();
    expect(projectCanLinkToReplay(project)).toBeFalsy();
  });
});
