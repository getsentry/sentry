import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithSpring, steps} from './spring';

describe('GettingStartedWithSpring', function () {
  it('renders doc correctly', function () {
    const {container} = render(<GettingStartedWithSpring dsn="test-dsn" />);

    // Steps
    for (const step of steps()) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type], level: 4})
      ).toBeInTheDocument();
    }

    expect(container).toSnapshot();
  });
});
