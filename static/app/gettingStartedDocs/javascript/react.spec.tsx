import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';

import GettingStartedWithReact, {nextSteps, steps} from './react';

describe('GettingStartedWithReact', function () {
  it('all products are selected', function () {
    render(
      <GettingStartedWithReact
        dsn="test-dsn"
        projectSlug="test-project"
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

  it('performance product is not selected', function () {
    render(
      <GettingStartedWithReact
        dsn="test-dsn"
        projectSlug="test-project"
        activeProductSelection={[ProductSolution.SESSION_REPLAY]}
      />
    );

    // Next Steps
    expect(
      screen.getByRole('link', {name: 'Performance Monitoring'})
    ).toBeInTheDocument();
  });

  it('session replay product is not selected', function () {
    render(
      <GettingStartedWithReact
        dsn="test-dsn"
        projectSlug="test-project"
        activeProductSelection={[ProductSolution.PERFORMANCE_MONITORING]}
      />
    );

    // Next Steps
    expect(screen.getByRole('link', {name: 'Session Replay'})).toBeInTheDocument();
  });
});
