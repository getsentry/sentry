import {AutofixDataFixture} from 'sentry-fixture/autofixData';
import {AutofixStepFixture} from 'sentry-fixture/autofixStep';
import {EventFixture} from 'sentry-fixture/event';
import {FrameFixture} from 'sentry-fixture/frame';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {EntryType} from 'sentry/types/event';
import {SolutionsHubDrawer} from 'sentry/views/issueDetails/streamline/sidebar/solutionsHubDrawer';

describe('SolutionsHubDrawer', () => {
  const organization = OrganizationFixture({
    genAIConsent: true,
    hideAiFeatures: false,
    features: ['gen-ai-features'],
  });

  const mockEvent = EventFixture({
    entries: [
      {
        type: EntryType.EXCEPTION,
        data: {values: [{stacktrace: {frames: [FrameFixture()]}}]},
      },
    ],
  });
  const mockGroup = GroupFixture();
  const mockProject = ProjectFixture();

  const mockAutofixData = AutofixDataFixture({steps: [AutofixStepFixture()]});

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/setup/`,
      body: {
        genAIConsent: {ok: true},
        integration: {ok: true},
        githubWriteIntegration: {ok: true},
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/summarize/`,
      method: 'POST',
      body: {
        whatsWrong: 'Test whats wrong',
        trace: 'Test trace',
        possibleCause: 'Test possible cause',
        headline: 'Test headline',
      },
    });
  });

  it('renders consent state if not consented', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/setup/`,
      body: {
        genAIConsent: {ok: false},
        integration: {ok: false},
        githubWriteIntegration: {ok: false},
      },
    });
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    render(
      <SolutionsHubDrawer event={mockEvent} group={mockGroup} project={mockProject} />,
      {organization}
    );

    expect(screen.getByTestId('ai-setup-loading-indicator')).toBeInTheDocument();

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    expect(screen.getByText(mockEvent.id)).toBeInTheDocument();

    expect(screen.getByRole('heading', {name: 'Sentry AI beta'})).toBeInTheDocument();

    expect(screen.getByTestId('ai-setup-data-consent')).toBeInTheDocument();
  });

  it('renders initial state correctly', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    render(
      <SolutionsHubDrawer event={mockEvent} group={mockGroup} project={mockProject} />,
      {organization}
    );

    expect(screen.getByTestId('ai-setup-loading-indicator')).toBeInTheDocument();

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    expect(screen.getByRole('heading', {name: 'Sentry AI beta'})).toBeInTheDocument();

    const startButton = screen.getByRole('button', {name: 'Start Autofix'});
    expect(startButton).toBeInTheDocument();
  });

  it('triggers autofix on clicking the Start button', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      method: 'POST',
      body: {autofix: null},
    });
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      method: 'GET',
      body: {autofix: null},
    });

    render(
      <SolutionsHubDrawer event={mockEvent} group={mockGroup} project={mockProject} />,
      {organization}
    );

    expect(screen.getByTestId('ai-setup-loading-indicator')).toBeInTheDocument();

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    const startButton = screen.getByRole('button', {name: 'Start Autofix'});
    await userEvent.click(startButton);

    expect(await screen.findByRole('button', {name: 'Start Over'})).toBeInTheDocument();
  });

  it('displays autofix steps and Start Over button when autofixData is available', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: mockAutofixData},
    });

    render(
      <SolutionsHubDrawer event={mockEvent} group={mockGroup} project={mockProject} />,
      {organization}
    );

    expect(await screen.findByRole('button', {name: 'Start Over'})).toBeInTheDocument();
  });

  it('resets autofix on clicking the start over button', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: mockAutofixData},
    });

    render(
      <SolutionsHubDrawer event={mockEvent} group={mockGroup} project={mockProject} />,
      {organization}
    );

    const startOverButton = await screen.findByRole('button', {name: 'Start Over'});
    expect(startOverButton).toBeInTheDocument();
    await userEvent.click(startOverButton);

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Start Autofix'})).toBeInTheDocument();
    });
  });

  it('shows setup if not complete', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/setup/`,
      body: {
        genAIConsent: {ok: true},
        integration: {ok: false},
        githubWriteIntegration: {ok: false, repos: []},
      },
    });
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/?provider_key=github&includeConfig=0',
      body: [],
    });

    render(
      <SolutionsHubDrawer event={mockEvent} group={mockGroup} project={mockProject} />,
      {organization}
    );

    expect(screen.getByTestId('ai-setup-loading-indicator')).toBeInTheDocument();

    await waitForElementToBeRemoved(() =>
      screen.queryByTestId('ai-setup-loading-indicator')
    );

    expect(screen.getByRole('heading', {name: 'Sentry AI beta'})).toBeInTheDocument();

    expect(screen.queryByRole('button', {name: 'Start Autofix'})).not.toBeInTheDocument();

    expect(await screen.findByText('Install the GitHub Integration')).toBeInTheDocument();
  });
});
