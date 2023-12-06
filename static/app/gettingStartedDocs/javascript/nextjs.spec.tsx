import {Organization} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithNextJs, steps} from './nextjs';

describe('GettingStartedWithNextJs', function () {
  const organization = Organization();
  it('renders doc correctly', function () {
    render(
      <GettingStartedWithNextJs
        dsn="test-dsn"
        projectSlug="test-project"
        organization={organization}
      />
    );

    // Steps
    for (const step of steps({
      dsn: 'test-dsn',
      projectSlug: 'test-project',
      organization,
    })) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }
  });
});
