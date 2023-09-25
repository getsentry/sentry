import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {
  GettingStartedWithSpringBoot,
  PackageManager,
  SpringBootVersion,
  steps,
} from './spring-boot';

describe('GettingStartedWithSpringBoot', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithSpringBoot dsn="test-dsn" projectSlug="test-project" />);

    // Steps
    for (const step of steps({
      dsn: 'test-dsn',
      springBootVersion: SpringBootVersion.V2,
      packageManager: PackageManager.MAVEN,
      hasPerformance: true,
    })) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }
  });
});
