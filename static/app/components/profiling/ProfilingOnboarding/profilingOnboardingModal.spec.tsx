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
    // @ts-ignore no-console
    // eslint-disable-next-line no-console
    jest.spyOn(console, 'error').mockImplementation(jest.fn());
  });
  afterEach(() => {
    MockApiClient.clearMockResponses();
    ProjectStore.teardown();
    // @ts-ignore no-console
    // eslint-disable-next-line no-console
    console.error.mockRestore();
  });

  it('renders default step', () => {
    const organization = TestStubs.Organization();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdk-updates/`,
      body: [],
    });

    render(
      <ProfilingOnboardingModal organization={organization} {...MockRenderModalProps} />
    );
    expect(screen.getByText(/Select a Project/i)).toBeInTheDocument();
  });

  it('goes to next step and previous step if project is supported', () => {
    const organization = TestStubs.Organization();
    ProjectStore.loadInitialData([
      TestStubs.Project({name: 'iOS Project', platform: 'apple-ios'}),
    ]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdk-updates/`,
      body: [],
    });

    render(
      <ProfilingOnboardingModal organization={organization} {...MockRenderModalProps} />
    );
    selectProject(TestStubs.Project({name: 'iOS Project'}));
    act(() => {
      userEvent.click(screen.getAllByText('Next')[0]);
    });
    expect(screen.getByText(/Step 2 of 2/i)).toBeInTheDocument();

    act(() => {
      userEvent.click(screen.getAllByText('Back')[0]);
    });
    expect(screen.getByText(/Select a Project/i)).toBeInTheDocument();
  });

  it('does not allow going to next step if project is unsupported', () => {
    const organization = TestStubs.Organization();
    ProjectStore.loadInitialData([
      TestStubs.Project({name: 'javascript', platform: 'javascript'}),
    ]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdk-updates/`,
      body: [],
    });

    render(
      <ProfilingOnboardingModal organization={organization} {...MockRenderModalProps} />
    );
    selectProject(TestStubs.Project({name: 'javascript'}));
    userEvent.click(screen.getAllByText('Next')[0]);

    expect(screen.getByRole('button', {name: /Next/i})).toBeDisabled();
  });

  it('shows sdk updates are required if version is lower than required', async () => {
    const organization = TestStubs.Organization();
    const project = TestStubs.Project({name: 'iOS Project', platform: 'apple-ios'});
    ProjectStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdk-updates/`,
      body: [
        {
          projectId: project.id,
          sdkName: 'sentry ios',
          sdkVersion: '6.0.0',
          suggestions: [],
        },
      ],
    });

    render(
      <ProfilingOnboardingModal organization={organization} {...MockRenderModalProps} />
    );

    selectProject(project);

    expect(
      await screen.findByText(/Update your projects SDK version/)
    ).toBeInTheDocument();
  });
});
