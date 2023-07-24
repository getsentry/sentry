import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  GettingStartedWithMacos,
  steps,
} from 'sentry/gettingStartedDocs/apple/apple-macos';

describe('GettingStartedWithMacos', function () {
  it('renders doc correctly', function () {
    const {container} = render(<GettingStartedWithMacos dsn="test-dsn" />);

    // Steps
    for (const step of steps()) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }

    expect(container).toSnapshot();
  });
});
