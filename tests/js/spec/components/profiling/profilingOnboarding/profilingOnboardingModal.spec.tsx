import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {ProfilingOnboardingModal} from 'sentry/components/profiling/ProfilingOnboarding/profilingOnboardingModal';
import ProjectStore from 'sentry/stores/projectsStore';
import {Project} from 'sentry/types/project';

const MockRenderModalProps: ModalRenderProps = {
  Body: ({children}) => <div>{children}</div>,
  Header: ({children}) => <div>{children}</div>,
  Footer: ({children}) => <div>{children}</div>,
  CloseButton: ({children}) => <div>{children}</div>,
  closeModal: jest.fn(),
  onDismiss: jest.fn(),
} as unknown as ModalRenderProps;

function selectProject(project: Project) {
  if (!project.name) {
    throw new Error(`Selected project requires a name, received ${project.name}`);
  }

  userEvent.click(screen.getAllByRole('textbox')[0]);
  userEvent.click(screen.getByText(project.name));
}

describe('ProfilingOnboarding', function () {
  beforeEach(() => {
    ProjectStore.teardown();
  });
  it('renders default step', () => {
    render(<ProfilingOnboardingModal {...MockRenderModalProps} />);
    expect(screen.getByText(/Select a Project/i)).toBeInTheDocument();
  });

  it('goes to next step and previous step if project is supported', () => {
    ProjectStore.loadInitialData([
      TestStubs.Project({name: 'iOS Project', platform: 'apple-ios'}),
    ]);

    render(<ProfilingOnboardingModal {...MockRenderModalProps} />);
    selectProject(TestStubs.Project({name: 'iOS Project'}));
    act(() => {
      userEvent.click(screen.getAllByText('Next')[0]);
    });
    expect(screen.getByText(/Step 2 of 2/i)).toBeInTheDocument();

    // Previous step
    act(() => {
      userEvent.click(screen.getAllByText('Back')[0]);
    });
    expect(screen.getByText(/Select a Project/i)).toBeInTheDocument();
  });

  it('does not allow going to next step if project is unsupported', () => {
    ProjectStore.loadInitialData([
      TestStubs.Project({name: 'javascript', platform: 'javascript'}),
    ]);

    render(<ProfilingOnboardingModal {...MockRenderModalProps} />);
    selectProject(TestStubs.Project({name: 'javascript'}));
    act(() => {
      userEvent.click(screen.getAllByText('Next')[0]);
    });
    expect(screen.getByRole('button', {name: /Next/i})).toBeDisabled();
  });
});
