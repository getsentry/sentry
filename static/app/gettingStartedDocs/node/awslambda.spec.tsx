import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithAwsLambda, steps} from './awslambda';

describe('GettingStartedWithAwsLambda', function () {
  it('renders doc correctly', function () {
    const {container} = render(<GettingStartedWithAwsLambda dsn="test-dsn" />);

    // Steps
    for (const step of steps()) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }

    expect(container).toSnapshot();
  });
});
