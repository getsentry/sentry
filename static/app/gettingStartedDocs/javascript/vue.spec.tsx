import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';

import {GettingStartedWithVue, nextSteps, steps, VueVersion} from './vue';

describe('GettingStartedWithVue', function () {
  it('all products are selected', function () {
    render(
      <GettingStartedWithVue
        dsn="test-dsn"
        projectSlug="test-project"
        activeProductSelection={[
          ProductSolution.PERFORMANCE_MONITORING,
          ProductSolution.SESSION_REPLAY,
        ]}
      />
    );

    // Steps
    for (const step of steps({
      vueVersion: VueVersion.V3,
      sentryInitContent: 'test-init-content',
    })) {
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
