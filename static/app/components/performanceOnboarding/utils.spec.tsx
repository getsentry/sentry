import {ProjectFixture} from 'sentry-fixture/project';

import type {PlatformKey, Project} from 'sentry/types/project';

import {generateDocKeys} from './utils';

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
