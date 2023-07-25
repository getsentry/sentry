import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithAndroid, steps} from './android';

describe('GettingStartedWithAndroid', function () {
  it('renders doc correctly', function () {
    const {container} = render(<GettingStartedWithAndroid dsn="test-dsn" />);

    // Steps
    for (const step of steps()) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }

    expect(container).toSnapshot();
  });
});
