import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithRubyRack, steps} from './rack';

describe('GettingStartedWithRubyRack', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithRubyRack dsn="test-dsn" projectSlug="test-project" />);

    // Steps
    for (const step of steps()) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }
  });
});
