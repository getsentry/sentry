import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithNextJs, steps} from './nextjs';

describe('GettingStartedWithNextJs', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithNextJs dsn="test-dsn" projectSlug="test-project" />);

    // Steps
    for (const step of steps({dsn: 'test-dsn', projectSlug: 'test-project'})) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }
  });
});
