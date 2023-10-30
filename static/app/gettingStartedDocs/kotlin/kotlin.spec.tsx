import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithKotlin, PackageManager, steps} from './kotlin';

describe('GettingStartedWithKotlin', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithKotlin dsn="test-dsn" projectSlug="test-project" />);

    // Steps
    for (const step of steps({
      dsn: 'test-dsn',
      hasPerformance: true,
      packageManager: PackageManager.GRADLE,
    })) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }
  });
});
