import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithJava, steps} from './java';

describe('GettingStartedWithJava', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithJava dsn="test-dsn" projectSlug="test-project" />);

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
