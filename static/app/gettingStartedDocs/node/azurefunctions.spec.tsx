import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithAzurefunctions, steps} from './azurefunctions';

describe('GettingStartedWithAzurefunctions', function () {
  it('renders doc correctly', function () {
    const {container} = render(<GettingStartedWithAzurefunctions dsn="test-dsn" />);

    // Steps
    for (const step of steps()) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }

    expect(container).toSnapshot();
  });
});
