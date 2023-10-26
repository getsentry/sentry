import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithCapacitor, SiblingOption, steps} from './capacitor';

describe('GettingStartedWithCapacitor', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithCapacitor dsn="test-dsn" projectSlug="test-project" />);

    // Steps
    for (const step of steps({
      siblingOption: SiblingOption.AngularV12,
      errorHandlerProviders: 'test-error-handler-providers',
      sentryInitContent: 'test-init-content',
    })) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }
  });
});
