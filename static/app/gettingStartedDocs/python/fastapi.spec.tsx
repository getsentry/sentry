import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithFastApi, steps} from './fastapi';

describe('GettingStartedWithFastApi', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithFastApi dsn="test-dsn" projectSlug="test-project" />);

    // Steps
    for (const step of steps({sentryInitContent: 'test-init-content'})) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }
  });
});
