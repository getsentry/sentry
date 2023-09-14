import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithLog4j2, steps} from './log4j2';

describe('GettingStartedWithLog4j2', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithLog4j2 dsn="test-dsn" />);

    // Steps
    for (const step of steps({
      dsn: 'test-dsn',
    })) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }
  });
});
