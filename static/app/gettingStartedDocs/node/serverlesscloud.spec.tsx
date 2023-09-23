import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithServerlesscloud, steps} from './serverlesscloud';

describe('GettingStartedWithServerlesscloud', function () {
  it('renders doc correctly', function () {
    render(
      <GettingStartedWithServerlesscloud dsn="test-dsn" projectSlug="test-project" />
    );

    // Steps
    for (const step of steps()) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }
  });
});
