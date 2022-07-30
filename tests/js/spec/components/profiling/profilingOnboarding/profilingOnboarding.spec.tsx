import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {ProfilingOnboardingModal} from 'sentry/components/profiling/ProfilingOnboarding/profilingOnboardingModal';

const MockRenderModalProps: ModalRenderProps = {
  Body: ({children}) => <div>{children}</div>,
  Header: ({children}) => <div>{children}</div>,
  Footer: ({children}) => <div>{children}</div>,
} as ModalRenderProps;

describe('ProfilingOnboarding', function () {
  it('renders default step', () => {
    render(<ProfilingOnboardingModal {...MockRenderModalProps} />);
    expect(screen.getByText(/Select a Project/i)).toBeInTheDocument();
  });

  it('goes to next step and previous step', () => {
    render(<ProfilingOnboardingModal {...MockRenderModalProps} />);
    // Next step
    act(() => {
      userEvent.click(screen.getAllByText('Next')[0]);
    });
    expect(screen.getByText(/Send Debug Files/i)).toBeInTheDocument();

    // Previous step
    act(() => {
      userEvent.click(screen.getAllByText('Back')[0]);
    });
    expect(screen.getByText(/Select a Project/i)).toBeInTheDocument();
  });
});
