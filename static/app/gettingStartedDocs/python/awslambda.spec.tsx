import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithAwsLambda, steps} from './awslambda';

describe('GettingStartedWithAwsLambda', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithAwsLambda dsn="test-dsn" projectSlug="test-project" />);

    // Steps
    for (const step of steps({sentryInitContent: 'test-init-content', dsn: 'test-dsn'})) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }
  });
});
