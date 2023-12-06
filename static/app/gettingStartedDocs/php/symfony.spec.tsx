import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithSymfony, steps} from './symfony';

describe('GettingStartedWithSymfony', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithSymfony dsn="test-dsn" projectSlug="test-project" />);

    // Steps
    for (const step of steps({
      dsn: 'test-dsn',
      hasPerformance: true,
      hasProfiling: true,
    })) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }
  });
});
