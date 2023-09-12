import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithAndroid, steps} from './android';

describe('GettingStartedWithAndroid', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithAndroid dsn="test-dsn" />);

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
