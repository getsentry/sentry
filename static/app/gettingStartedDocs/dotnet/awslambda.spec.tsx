import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedAwsLambda, steps} from './awslambda';

describe('GettingStartedAwsLambda', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedAwsLambda dsn="test-dsn" projectSlug="test-project" />);

    // Steps
    for (const step of steps()) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }
  });
});
