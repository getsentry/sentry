import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithSpring, PackageManager, SpringVersion, steps} from './spring';

describe('GettingStartedWithSpring', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithSpring dsn="test-dsn" projectSlug="test-project" />);

    // Steps
    for (const step of steps({
      dsn: 'test-dsn',
      packageManager: PackageManager.GRADLE,
      springVersion: SpringVersion.V6,
    })) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type], level: 4})
      ).toBeInTheDocument();
    }
  });
});
