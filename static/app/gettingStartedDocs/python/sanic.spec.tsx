import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithSanic, steps} from './sanic';

describe('GettingStartedWithSanic', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithSanic dsn="test-dsn" />);

    // Steps
    for (const step of steps({sentryInitContent: 'test-init-content'})) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }
  });
});
