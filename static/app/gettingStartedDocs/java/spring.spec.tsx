import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithSpring, steps} from './spring';

describe('GettingStartedWithSpring', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithSpring dsn="test-dsn" />);

    // Steps
    for (const step of steps({
      dsn: 'test-dsn',
    })) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type], level: 4})
      ).toBeInTheDocument();
    }
  });
});
