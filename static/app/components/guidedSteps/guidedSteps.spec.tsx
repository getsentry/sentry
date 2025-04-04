import {useState} from 'react';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {Button} from 'sentry/components/core/button';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import {useNavigate} from 'sentry/utils/useNavigate';

jest.mock('sentry/utils/useNavigate');

const mockUseNavigate = jest.mocked(useNavigate);
const mockNavigate = jest.fn();
mockUseNavigate.mockReturnValue(mockNavigate);

function Component({completedSteps}: {completedSteps?: string[]}) {
  return (
    <GuidedSteps>
      <GuidedSteps.Step
        stepKey="step-1"
        title="Step 1 Title"
        isCompleted={completedSteps?.includes('step-1')}
      >
        This is the first step.
        <GuidedSteps.StepButtons />
      </GuidedSteps.Step>
      <GuidedSteps.Step
        stepKey="step-2"
        title="Step 2 Title"
        isCompleted={completedSteps?.includes('step-2')}
      >
        This is the second step.
        <GuidedSteps.StepButtons />
      </GuidedSteps.Step>
      <GuidedSteps.Step
        stepKey="step-3"
        title="Step 3 Title"
        isCompleted={completedSteps?.includes('step-3')}
      >
        This is the third step.
        <GuidedSteps.StepButtons />
      </GuidedSteps.Step>
      <GuidedSteps.Step
        stepKey="step-4"
        title="Step 4 Title"
        isCompleted={completedSteps?.includes('step-4')}
      >
        This is the fourth step.
        <GuidedSteps.StepButtons />
      </GuidedSteps.Step>
    </GuidedSteps>
  );
}

describe('GuidedSteps', function () {
  const router = RouterFixture();

  it('renders step based on the query param and shows previous ones as completed', function () {
    render(<Component />, {
      router: {
        ...router,
        location: {
          ...router.location,
          query: {guidedStep: '3'},
        },
      },
    });

    expect(screen.queryByText('This is the first step.')).not.toBeInTheDocument();
    expect(screen.queryByText('This is the second step.')).not.toBeInTheDocument();
    expect(screen.getByText('This is the third step.')).toBeInTheDocument();
    expect(screen.queryByText('This is the fourth step.')).not.toBeInTheDocument();

    // Previous steps are shown as completed
    expect(
      within(screen.getByTestId('guided-step-1')).getByTestId('icon-check-mark')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('guided-step-2')).getByTestId('icon-check-mark')
    ).toBeInTheDocument();
  });

  it('update url query param when navigating through steps', async function () {
    render(<Component />, {
      router,
    });

    expect(screen.getByText('This is the first step.')).toBeInTheDocument();
    expect(screen.queryByText('This is the second step.')).not.toBeInTheDocument();
    expect(screen.queryByText('This is the third step.')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Next'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        ...router.location,
        query: {guidedStep: 2},
      })
    );
  });

  it('update query param to starts at the first incomplete step', function () {
    render(<Component completedSteps={['step-1']} />);

    // First step is shown as completed
    expect(
      within(screen.getByTestId('guided-step-1')).getByTestId('icon-check-mark')
    ).toBeInTheDocument();

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        ...router.location,
        query: {guidedStep: 2},
      })
    );
  });

  it('advances to the next step when the current one is completed', async function () {
    function Comp() {
      const [completedSteps, setCompletedSteps] = useState<string[]>([]);

      return (
        <div>
          <Button onClick={() => setCompletedSteps(['step-1'])}>Complete Step</Button>
          <Component completedSteps={completedSteps} />
        </div>
      );
    }

    render(<Comp />);

    // First step is shown as active and not completed
    expect(screen.getByText('This is the first step.')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('guided-step-1')).queryByTestId('icon-check-mark')
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Complete Step'}));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        ...router.location,
        query: {guidedStep: 2},
      })
    );
  });
});
