import {Project as ProjectFixture} from 'sentry-fixture/project';

import {PlatformIntegration, PlatformKey, Project} from 'sentry/types';

import {generateDocKeys, isPlatformSupported} from './utils';

describe('performanceOnboarding/utils/generateDocKeys()', () => {
  it('should generate the correct onboarding keys for a React project', () => {
    const project = ProjectFixture({
      platform: 'javascript-react',
      firstTransactionEvent: false,
    }) as Project & {platform: PlatformKey};

    const docKeys = generateDocKeys(project.platform);

    expect(docKeys).toEqual([
      'javascript-react-performance-onboarding-1-install',
      'javascript-react-performance-onboarding-2-configure',
      'javascript-react-performance-onboarding-3-verify',
    ]);
  });

  it('should generate the correct onboarding keys for an Angular project', () => {
    const project = ProjectFixture({
      platform: 'javascript-angular',
      firstTransactionEvent: false,
    }) as Project & {platform: PlatformKey};

    const docKeys = generateDocKeys(project.platform);

    expect(docKeys).toEqual([
      'javascript-angular-performance-onboarding-1-install',
      'javascript-angular-performance-onboarding-2-configure',
      'javascript-angular-performance-onboarding-3-verify',
    ]);
  });

  it('should generate the correct onboarding keys for an Elixir project', () => {
    const project = ProjectFixture({
      platform: 'elixir',
      firstTransactionEvent: false,
    }) as Project & {platform: PlatformKey};

    const docKeys = generateDocKeys(project.platform);

    expect(docKeys).toEqual([
      'elixir-performance-onboarding-1-install',
      'elixir-performance-onboarding-2-configure',
      'elixir-performance-onboarding-3-verify',
    ]);
  });
});

describe('performanceOnboarding/utils/isPlatformSupported()', () => {
  it('should not support docs when there is no platform selected', () => {
    expect(isPlatformSupported(undefined)).toBeFalsy();
  });

  it('should not support docs when the platform does not support performance', () => {
    expect(isPlatformSupported({id: 'elixir'} as PlatformIntegration)).toBeFalsy();
  });

  it('should support docs when the platform has support for performance onboarding', () => {
    expect(isPlatformSupported({id: 'javascript'} as PlatformIntegration)).toBeTruthy();
    expect(
      isPlatformSupported({id: 'javascript-react'} as PlatformIntegration)
    ).toBeTruthy();
  });
});
