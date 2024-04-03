import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';

describe('GuidedSteps', function () {
  it('can navigate through steps and shows previous ones as completed', async function () {
    render(
      <GuidedSteps>
        <GuidedSteps.Step stepKey="step-1" title="Step 1 Title">
          This is the first step.
          <GuidedSteps.StepButtons />
        </GuidedSteps.Step>
        <GuidedSteps.Step stepKey="step-2" title="Step 2 Title">
          This is the second step.
          <GuidedSteps.StepButtons />
        </GuidedSteps.Step>
        <GuidedSteps.Step stepKey="step-3" title="Step 3 Title">
          This is the third step.
          <GuidedSteps.StepButtons />
        </GuidedSteps.Step>
      </GuidedSteps>
    );

    expect(screen.getByText('This is the first step.')).toBeInTheDocument();
    expect(screen.queryByText('This is the second step.')).not.toBeInTheDocument();
    expect(screen.queryByText('This is the third step.')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Next'));

    expect(screen.queryByText('This is the first step.')).not.toBeInTheDocument();
    expect(screen.getByText('This is the second step.')).toBeInTheDocument();
    expect(screen.queryByText('This is the third step.')).not.toBeInTheDocument();

    // First step is shown as completed
    expect(
      within(screen.getByTestId('guided-step-1')).getByTestId('icon-check-mark')
    ).toBeInTheDocument();
  });

  it('starts at the first incomplete step', function () {
    render(
      <GuidedSteps>
        <GuidedSteps.Step stepKey="step-1" title="Step 1 Title" isCompleted>
          This is the first step.
          <GuidedSteps.StepButtons />
        </GuidedSteps.Step>
        <GuidedSteps.Step stepKey="step-2" title="Step 2 Title" isCompleted={false}>
          This is the second step.
          <GuidedSteps.StepButtons />
        </GuidedSteps.Step>
        <GuidedSteps.Step stepKey="step-3" title="Step 3 Title" isCompleted={false}>
          This is the third step.
          <GuidedSteps.StepButtons />
        </GuidedSteps.Step>
      </GuidedSteps>
    );

    // First step is shown as completed
    expect(
      within(screen.getByTestId('guided-step-1')).getByTestId('icon-check-mark')
    ).toBeInTheDocument();

    // Second step is shown as active
    expect(screen.queryByText('This is the first step.')).not.toBeInTheDocument();
    expect(screen.getByText('This is the second step.')).toBeInTheDocument();
    expect(screen.queryByText('This is the third step.')).not.toBeInTheDocument();
  });
});
