import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithJava, PackageManager, steps} from './java';

describe('GettingStartedWithJava', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithJava dsn="test-dsn" projectSlug="test-project" />);

    // Steps
    for (const step of steps({
      dsn: 'test-dsn',
      packageManager: PackageManager.GRADLE,
      hasPerformance: true,
    })) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }
  });
});
