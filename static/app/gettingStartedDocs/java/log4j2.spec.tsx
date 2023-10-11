import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithLog4j2, PackageManager, steps} from './log4j2';

describe('GettingStartedWithLog4j2', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithLog4j2 dsn="test-dsn" projectSlug="test-project" />);

    // Steps
    for (const step of steps({
      dsn: 'test-dsn',
      packageManager: PackageManager.GRADLE,
    })) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }
  });
});
