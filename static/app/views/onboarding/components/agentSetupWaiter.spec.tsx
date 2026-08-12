import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import {EventOrGroupType} from 'sentry/types/event';
import {AgentSetupWaiter} from 'sentry/views/onboarding/components/agentSetupWaiter';

describe('AgentSetupWaiter', () => {
  const organization = OrganizationFixture();
  const agentProject = ProjectFixture({id: '10', slug: 'agent-witness'});

  function mockProjects(projects: Array<ReturnType<typeof ProjectFixture>>) {
    return MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: projects,
    });
  }

  function mockIssues(issues: Array<ReturnType<typeof GroupFixture>>) {
    return MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${agentProject.slug}/issues/`,
      body: issues,
    });
  }

  // The interval only has to outlast a render; the transitions are awaited.
  function renderWaiter() {
    return render(
      <OnboardingContextProvider>
        <AgentSetupWaiter pollInterval={20} />
      </OnboardingContextProvider>,
      {organization}
    );
  }

  afterEach(() => {
    MockApiClient.clearMockResponses();
    window.sessionStorage.clear();
  });

  it('shows both milestones while waiting for the project', async () => {
    mockProjects([]);

    renderWaiter();

    expect(await screen.findByText('Waiting for project creation')).toBeInTheDocument();
    expect(screen.getByText('Waiting for verification error')).toBeInTheDocument();
    expect(screen.queryByText('Project created:')).not.toBeInTheDocument();
  });

  it('reports the project once the agent creates it', async () => {
    mockProjects([]);

    renderWaiter();

    expect(await screen.findByText('Waiting for project creation')).toBeInTheDocument();

    mockProjects([agentProject]);
    mockIssues([]);

    expect(await screen.findByText('Project created:')).toBeInTheDocument();
    expect(screen.getByText('agent-witness')).toBeInTheDocument();
    // The second milestone is still outstanding
    expect(screen.getByText('Waiting for verification error')).toBeInTheDocument();
  });

  it('links the verification error once it lands', async () => {
    mockProjects([]);

    renderWaiter();

    expect(await screen.findByText('Waiting for project creation')).toBeInTheDocument();

    mockProjects([agentProject]);
    mockIssues([
      GroupFixture({
        id: '42',
        project: agentProject,
        type: EventOrGroupType.ERROR,
        metadata: {value: 'Sentry verification: agent-witness first error'},
      }),
    ]);

    const link = await screen.findByRole('link', {
      name: /Sentry verification: agent-witness first error/,
    });
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining(`/organizations/${organization.slug}/issues/42/`)
    );

    await userEvent.tab();
    expect(link).toHaveFocus();
    await userEvent.tab();
    expect(link).not.toContainElement(document.activeElement as HTMLElement);

    expect(screen.queryByText('Waiting for verification error')).not.toBeInTheDocument();
  });

  it('ignores projects that already existed when it mounted', async () => {
    const preexistingProject = ProjectFixture({id: '1', slug: 'preexisting'});
    mockProjects([preexistingProject]);

    renderWaiter();

    expect(await screen.findByText('Waiting for project creation')).toBeInTheDocument();

    // Give the poll several chances to mistake the existing project for a new one
    await waitFor(() => {
      expect(screen.queryByText('Project created:')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Waiting for project creation')).toBeInTheDocument();

    mockProjects([preexistingProject, agentProject]);
    mockIssues([]);

    expect(await screen.findByText('Project created:')).toBeInTheDocument();
    expect(screen.getByText('agent-witness')).toBeInTheDocument();
  });

  it('preserves the project baseline across remounts', async () => {
    const preexistingProject = ProjectFixture({id: '1', slug: 'preexisting'});
    mockProjects([preexistingProject]);

    const {unmount} = renderWaiter();

    expect(await screen.findByText('Waiting for project creation')).toBeInTheDocument();

    mockProjects([preexistingProject, agentProject]);
    mockIssues([]);

    expect(await screen.findByText('Project created:')).toBeInTheDocument();

    unmount();
    renderWaiter();

    expect(await screen.findByText('Project created:')).toBeInTheDocument();
    expect(screen.getByText('agent-witness')).toBeInTheDocument();
  });
});
