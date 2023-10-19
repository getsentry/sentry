import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithLogBack, PackageManager, steps} from './logback';

describe('GettingStartedWithLogBack', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithLogBack dsn="test-dsn" projectSlug="test-project" />);

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
