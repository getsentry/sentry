import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithGCPFunctions, steps} from './gcpfunctions';

describe('GettingStartedWithGCPFunctions', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithGCPFunctions dsn="test-dsn" projectSlug="test-project" />);

    // Steps
    for (const step of steps({sentryInitContent: 'test-init-content', dsn: 'test-dsn'})) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }
  });
});
