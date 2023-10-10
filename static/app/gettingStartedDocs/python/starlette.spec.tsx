import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithStarlette, steps} from './starlette';

describe('GettingStartedWithDjango', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithStarlette dsn="test-dsn" projectSlug="test-project" />);

    // Steps
    for (const step of steps({sentryInitContent: 'test-init-content'})) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }
  });
});
