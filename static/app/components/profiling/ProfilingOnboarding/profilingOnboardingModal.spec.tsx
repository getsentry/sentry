import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {ProfilingOnboardingModal} from 'sentry/components/profiling/ProfilingOnboarding/profilingOnboardingModal';
import ProjectsStore from 'sentry/stores/projectsStore';
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
  if (!project.slug) {
    throw new Error(`Selected project requires a name, received ${project.slug}`);
  }

  userEvent.click(screen.getAllByRole('textbox')[0]);
  userEvent.click(screen.getByText(project.slug));
}

const organization = TestStubs.Organization();

describe('ProfilingOnboarding', function () {
  beforeEach(() => {
    // @ts-ignore no-console
    // eslint-disable-next-line no-console
    jest.spyOn(console, 'error').mockImplementation(jest.fn());
  });
  afterEach(() => {
    MockApiClient.clearMockResponses();
    // @ts-ignore no-console
    // eslint-disable-next-line no-console
    console.error.mockRestore();
  });

  it('renders default step', () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdk-updates/`,
      body: [],
    });

    render(
      <ProfilingOnboardingModal organization={organization} {...MockRenderModalProps} />
    );
    expect(screen.getByText(/Select a Project/i)).toBeInTheDocument();
  });

  it('goes to next step and previous step if project is supported', async () => {
    const project = TestStubs.Project({name: 'iOS Project'});
    ProjectsStore.loadInitialData([
      TestStubs.Project({name: 'iOS Project', platform: 'apple-ios'}),
    ]);
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/keys/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdk-updates/`,
      body: [],
    });

    render(
      <ProfilingOnboardingModal organization={organization} {...MockRenderModalProps} />
    );
    selectProject(project);
    await act(async () => {
      await screen.findByText(/options\.dsn/);
      userEvent.click(screen.getAllByText('Next')[0]);
    });
    expect(screen.getByText(/Step 2 of 2/i)).toBeInTheDocument();

    act(() => {
      userEvent.click(screen.getAllByText('Back')[0]);
    });
    expect(screen.getByText(/Select a Project/i)).toBeInTheDocument();
  });

  it('does not allow going to next step if project is unsupported', () => {
    ProjectsStore.loadInitialData([
      TestStubs.Project({name: 'javascript', platform: 'javascript'}),
    ]);

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/keys/`,
      body: [],
    });
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
    const project = TestStubs.Project({name: 'iOS Project', platform: 'apple-ios'});
    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/keys/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdk-updates/`,
      body: [
        {
          projectId: project.id,
          sdkName: 'sentry.cocoa',
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

  it('shows a sdk update URL when receiving a updateSdk suggestion if a version is lower than required', async () => {
    const project = TestStubs.Project({name: 'iOS Project', platform: 'apple-ios'});
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/keys/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdk-updates/`,
      body: [
        {
          projectId: project.id,
          sdkName: 'sentry.cocoa',
          sdkVersion: '6.0.0',
          suggestions: [
            {
              type: 'updateSdk',
              sdkName: 'sentry.cocoa',
              newSdkVersion: '9.0.0',
              sdkUrl: 'http://test/fake-slug',
            },
          ],
        },
      ],
    });

    render(
      <ProfilingOnboardingModal organization={organization} {...MockRenderModalProps} />
    );

    selectProject(project);

    const link = (await screen.findByText(/sentry\.cocoa@9\.0\.0/)) as HTMLAnchorElement;
    expect(link).toBeInTheDocument();
    expect(link.href).toBe('http://test/fake-slug');
  });

  it('does not show sdk updates for irrelevant sdk updates', () => {
    const project = TestStubs.Project({name: 'Android', platform: 'java-android'});
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/keys/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdk-updates/`,
      body: [
        {
          projectId: project.id,
          sdkName: 'sentry.java',
          sdkVersion: '6.0.0',
          suggestions: [
            {
              type: 'updateSdk',
              sdkName: 'sentry.java',
              newSdkVersion: '9.0.0',
              sdkUrl: 'http://test/fake-slug',
            },
          ],
        },
      ],
    });

    render(
      <ProfilingOnboardingModal organization={organization} {...MockRenderModalProps} />
    );

    selectProject(project);

    const link = screen.queryByText(/sentry\.java@9\.0\.0/);
    expect(link).not.toBeInTheDocument();
  });

  it('shows the public dsn within the codesnippet', async () => {
    const project = TestStubs.Project({name: 'iOS Project', platform: 'apple-ios'});
    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/keys/`,
      body: [
        {
          dsn: {
            public: 'http://fake-public-dsn.ingest.sentry.io',
          },
        },
      ],
    });
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
      await screen.findByText(/http:\/\/fake-public-dsn\.ingest\.sentry\.io/)
    ).toBeInTheDocument();
  });
});
