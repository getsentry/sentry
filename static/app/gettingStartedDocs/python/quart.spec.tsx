import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithQuart, steps} from './quart';

describe('GettingStartedWithDjango', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithQuart dsn="test-dsn" projectSlug="test-project" />);

    // Steps
    for (const step of steps({sentryInitContent: 'test-init-content'})) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }
  });
});
