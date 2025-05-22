import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {GroupSummary} from 'sentry/components/group/groupSummary';

describe('GroupSummary', function () {
  const mockEvent = EventFixture();
  const mockGroup = GroupFixture();
  const mockProject = ProjectFixture();
  const organization = OrganizationFixture({
    hideAiFeatures: false,
    features: ['gen-ai-features'],
  });

  const mockSummaryData = {
    groupId: '1',
    whatsWrong: 'Test whats wrong',
    trace: 'Test trace',
    possibleCause: 'Test possible cause',
    headline: 'Test headline',
    scores: {
      possibleCauseConfidence: 0.9,
      possibleCauseNovelty: 0.8,
    },
  };

  const mockSummaryDataWithNullScores = {
    groupId: '1',
    whatsWrong: 'Test whats wrong',
    trace: 'Test trace',
    possibleCause: 'Test possible cause',
    headline: 'Test headline',
    scores: null,
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/setup/`,
      method: 'GET',
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: true,
          userHasAcknowledged: true,
        },
        integration: {ok: true, reason: null},
        githubWriteIntegration: {
          ok: true,
          repos: [
            {
              ok: true,
              owner: 'owner',
              name: 'hello-world',
              provider: 'integrations:github',
            },
          ],
        },
      }),
    });
  });

  it('renders the summary with all sections', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/summarize/`,
      method: 'POST',
      body: mockSummaryData,
    });

    render(<GroupSummary event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization,
    });

    await waitFor(() => {
      expect(screen.getByText('What Happened')).toBeInTheDocument();
    });
    expect(await screen.findByText('Test whats wrong')).toBeInTheDocument();
    expect(screen.getByText('In the Trace')).toBeInTheDocument();
    expect(screen.getByText('Test trace')).toBeInTheDocument();
    expect(screen.getByText('Initial Guess')).toBeInTheDocument();
    expect(screen.getByText('Test possible cause')).toBeInTheDocument();
  });

  it('renders the summary with all sections when scores are null', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/summarize/`,
      method: 'POST',
      body: mockSummaryDataWithNullScores,
    });

    render(<GroupSummary event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization,
    });

    await waitFor(() => {
      expect(screen.getByText('What Happened')).toBeInTheDocument();
    });
    expect(await screen.findByText('Test whats wrong')).toBeInTheDocument();
    expect(screen.getByText('In the Trace')).toBeInTheDocument();
    expect(screen.getByText('Test trace')).toBeInTheDocument();
    expect(screen.getByText('Initial Guess')).toBeInTheDocument();
    expect(screen.getByText('Test possible cause')).toBeInTheDocument();
  });

  it('shows loading state', function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/summarize/`,
      method: 'POST',
      body: {},
    });

    render(<GroupSummary event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization,
    });

    // Should show loading placeholders. Currently we load the whatsWrong and possibleCause sections
    expect(screen.getAllByTestId('loading-placeholder')).toHaveLength(2);
  });

  it('shows error state', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/summarize/`,
      method: 'POST',
      body: {},
      statusCode: 400,
    });

    render(<GroupSummary event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization,
    });

    await waitFor(() => {
      expect(screen.getByText('Error loading summary')).toBeInTheDocument();
    });
  });

  it('hides cards with no content', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/summarize/`,
      method: 'POST',
      body: {
        ...mockSummaryData,
        trace: null,
      },
    });

    render(<GroupSummary event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization,
    });

    await waitFor(() => {
      expect(screen.getByText('What Happened')).toBeInTheDocument();
    });
    expect(await screen.findByText('Test whats wrong')).toBeInTheDocument();
    expect(screen.queryByText('In the Trace')).not.toBeInTheDocument();
    expect(screen.getByText('Initial Guess')).toBeInTheDocument();
    expect(screen.getByText('Test possible cause')).toBeInTheDocument();
  });

  it('renders in preview mode', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/summarize/`,
      method: 'POST',
      body: mockSummaryData,
    });

    render(
      <GroupSummary event={mockEvent} group={mockGroup} project={mockProject} preview />,
      {organization}
    );

    await waitFor(() => {
      expect(screen.getByText('Initial Guess')).toBeInTheDocument();
    });
    expect(await screen.findByText('Test possible cause')).toBeInTheDocument();
    expect(screen.queryByText('What Happened')).not.toBeInTheDocument();
    expect(screen.queryByText('Test whats wrong')).not.toBeInTheDocument();
    expect(screen.queryByText('In the Trace')).not.toBeInTheDocument();
    expect(screen.queryByText('Test trace')).not.toBeInTheDocument();
  });
});
