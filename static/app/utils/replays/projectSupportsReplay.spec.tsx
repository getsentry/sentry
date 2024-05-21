import {OrganizationFixture} from 'sentry-fixture/organization';

import type {MinimalProject, PlatformKey} from 'sentry/types';
import projectSupportsReplay, {
  projectCanLinkToReplay,
} from 'sentry/utils/replays/projectSupportsReplay';
import useOrganization from 'sentry/utils/useOrganization';

jest.mock('sentry/utils/useOrganization');

function mockProjectFixture(platform: PlatformKey): MinimalProject {
  return {
    id: '1',
    slug: 'test-project',
    platform,
  };
}

describe('projectSupportsReplay & projectCanLinkToReplay', () => {
  const organization = OrganizationFixture();
  jest.mocked(useOrganization).mockReturnValue(organization);

  it.each([
    'javascript-angular' as PlatformKey,
    'javascript-nextjs' as PlatformKey,
    'javascript-react' as PlatformKey,
    'javascript' as PlatformKey,
    'electron' as PlatformKey,
  ])('should SUPPORT & LINK frontend platform %s', platform => {
    const project = mockProjectFixture(platform);
    expect(projectSupportsReplay(project)).toBeTruthy();
    expect(projectCanLinkToReplay(project)).toBeTruthy();
  });

  it.each(['javascript-angularjs' as PlatformKey])(
    'should FAIL for old, unsupported frontend framework %s',
    platform => {
      const project = mockProjectFixture(platform);
      expect(projectSupportsReplay(project)).toBeFalsy();
      expect(projectCanLinkToReplay(project)).toBeFalsy();
    }
  );

  it.each([
    'node' as PlatformKey,
    'php' as PlatformKey,
    'bun' as PlatformKey,
    'elixir' as PlatformKey,
    'go' as PlatformKey,
  ])('should SUPPORT Backend framework %s', platform => {
    const project = mockProjectFixture(platform);
    expect(projectSupportsReplay(project)).toBeTruthy();
    expect(projectCanLinkToReplay(project)).toBeTruthy();
  });

  it.each(['java' as PlatformKey, 'rust' as PlatformKey, 'python' as PlatformKey])(
    'should NOT SUPPORT but CAN LINK for Backend framework %s',
    platform => {
      const project = mockProjectFixture(platform);
      expect(projectSupportsReplay(project)).toBeFalsy();
      expect(projectCanLinkToReplay(project)).toBeTruthy();
    }
  );

  it.each([
    'apple-macos' as PlatformKey,
    'flutter' as PlatformKey,
    'unity' as PlatformKey,
  ])('should FAIL for Desktop framework %s', platform => {
    const project = mockProjectFixture(platform);
    expect(projectSupportsReplay(project)).toBeFalsy();
    expect(projectCanLinkToReplay(project)).toBeFalsy();
  });
});
