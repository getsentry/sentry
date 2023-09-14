import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';

import GettingStartedWithJavaScript, {nextSteps, steps} from './javascript';

describe('GettingStartedWithJavaScript', function () {
  it('all products are selected', function () {
    render(
      <GettingStartedWithJavaScript
        dsn="test-dsn"
        activeProductSelection={[
          ProductSolution.PERFORMANCE_MONITORING,
          ProductSolution.SESSION_REPLAY,
        ]}
      />
    );

    // Steps
    for (const step of steps()) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }

    // Next Steps
    const filteredNextStepsLinks = nextSteps.filter(
      nextStep =>
        ![
          ProductSolution.PERFORMANCE_MONITORING,
          ProductSolution.SESSION_REPLAY,
        ].includes(nextStep.id as ProductSolution)
    );

    for (const filteredNextStepsLink of filteredNextStepsLinks) {
      expect(
        screen.getByRole('link', {name: filteredNextStepsLink.name})
      ).toBeInTheDocument();
    }
  });
});
