import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {PRODUCT} from 'sentry/components/onboarding/productSelection';

import GettingStartedWithReact, {nextSteps, steps} from './react';

describe('GettingStartedWithReact', function () {
  it('all products are selected', function () {
    const {container} = render(
      <GettingStartedWithReact
        dsn="test-dsn"
        activeProductSelection={[PRODUCT.PERFORMANCE_MONITORING, PRODUCT.SESSION_REPLAY]}
      />
    );

    // Steps
    for (const step of steps()) {
      expect(
        screen.getByRole('heading', {name: StepTitle[step.type]})
      ).toBeInTheDocument();
    }

    // Next Steps
    const filteredNextStepsLinks = nextSteps.filter(
      nextStep =>
        ![PRODUCT.PERFORMANCE_MONITORING, PRODUCT.SESSION_REPLAY].includes(
          nextStep.id as PRODUCT
        )
    );

    for (const filteredNextStepsLink of filteredNextStepsLinks) {
      expect(
        screen.getByRole('link', {name: filteredNextStepsLink.name})
      ).toBeInTheDocument();
    }

    expect(container).toSnapshot();
  });

  it('performance product is not selected', function () {
    render(
      <GettingStartedWithReact
        dsn="test-dsn"
        activeProductSelection={[PRODUCT.SESSION_REPLAY]}
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
        activeProductSelection={[PRODUCT.PERFORMANCE_MONITORING]}
      />
    );

    // Next Steps
    expect(screen.getByRole('link', {name: 'Session Replay'})).toBeInTheDocument();
  });
});
