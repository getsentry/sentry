import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithNextJs, steps} from './nextjs';

describe('GettingStartedWithNextJs', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithNextJs dsn="test-dsn" />);

    // Steps
    for (const step of steps()) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }
  });
});
