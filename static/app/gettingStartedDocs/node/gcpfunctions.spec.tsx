import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithGCPFunctions, steps} from './gcpfunctions';

describe('GettingStartedWithGCPFunctions', function () {
  it('all products are selected', function () {
    const {container} = render(<GettingStartedWithGCPFunctions dsn="test-dsn" />);

    // Steps
    for (const step of steps()) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }

    expect(container).toSnapshot();
  });
});
