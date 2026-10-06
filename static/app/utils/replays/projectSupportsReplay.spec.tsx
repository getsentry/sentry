import {OrganizationFixture} from 'sentry-fixture/organization';

import type {PlatformKey} from 'sentry/types/platform';
import type {MinimalProject} from 'sentry/types/project';
import {
  projectCanLinkToReplay,
  projectSupportsReplay,
} from 'sentry/utils/replays/projectSupportsReplay';

function mockProjectFixture(platform: PlatformKey): MinimalProject {
  return {
    id: '1',
    slug: 'test-project',
    platform,
  };
}

describe('projectSupportsReplay & projectCanLinkToReplay', () => {
  const organization = OrganizationFixture();

  it.each([
    'javascript-angular',
    'javascript-nextjs',
    'javascript-react',
    'javascript',
    'electron',
  ] as const)('should SUPPORT & LINK frontend platform %s', platform => {
    const project = mockProjectFixture(platform);
    expect(projectSupportsReplay(project)).toBeTruthy();
    expect(projectCanLinkToReplay(organization, project)).toBeTruthy();
  });

  it.each(['javascript-angularjs'] as const)(
    'should FAIL for old, unsupported frontend framework %s',
    platform => {
      const project = mockProjectFixture(platform);
      expect(projectSupportsReplay(project)).toBeFalsy();
      expect(projectCanLinkToReplay(organization, project)).toBeFalsy();
    }
  );

  it.each(['node', 'php', 'bun', 'elixir', 'go'] as const)(
    'should SUPPORT Backend framework %s',
    platform => {
      const project = mockProjectFixture(platform);
      expect(projectSupportsReplay(project)).toBeTruthy();
      expect(projectCanLinkToReplay(organization, project)).toBeTruthy();
    }
  );

  it.each(['java', 'rust', 'python'] as const)(
    'should NOT SUPPORT but CAN LINK for Backend framework %s',
    platform => {
      const project = mockProjectFixture(platform);
      expect(projectSupportsReplay(project)).toBeFalsy();
      expect(projectCanLinkToReplay(organization, project)).toBeTruthy();
    }
  );

  it('should FAIL for Desktop framework apple-macos', () => {
    const project = mockProjectFixture('apple-macos');
    expect(projectSupportsReplay(project)).toBeFalsy();
    expect(projectCanLinkToReplay(organization, project)).toBeFalsy();
  });

  it('should SUPPORT & LINK gaming platform unreal', () => {
    const project = mockProjectFixture('unreal');
    expect(projectSupportsReplay(project)).toBeTruthy();
    expect(projectCanLinkToReplay(organization, project)).toBeTruthy();
  });
});
