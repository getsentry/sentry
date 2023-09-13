import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithSpringBoot, steps} from './spring-boot';

describe('GettingStartedWithSpringBoot', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithSpringBoot dsn="test-dsn" />);

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
