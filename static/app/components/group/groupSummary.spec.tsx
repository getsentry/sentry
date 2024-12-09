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
    genAIConsent: true,
    hideAiFeatures: false,
    features: ['gen-ai-features'],
  });

  const mockSummaryData = {
    groupId: '1',
    whatsWrong: 'Test whats wrong',
    trace: 'Test trace',
    possibleCause: 'Test possible cause',
    headline: 'Test headline',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/setup/`,
      method: 'GET',
      body: {
        genAIConsent: {ok: true},
        integration: {ok: true},
        githubWriteIntegration: {
          repos: [{ok: true, owner: 'owner', name: 'hello-world', id: 100}],
        },
      },
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
      expect(screen.getByText("What's wrong")).toBeInTheDocument();
      expect(screen.getByText('Test whats wrong')).toBeInTheDocument();
      expect(screen.getByText('In the trace')).toBeInTheDocument();
      expect(screen.getByText('Test trace')).toBeInTheDocument();
      expect(screen.getByText('Possible cause')).toBeInTheDocument();
      expect(screen.getByText('Test possible cause')).toBeInTheDocument();
    });
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

    // Should show loading placeholders
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
      expect(screen.getByText("What's wrong")).toBeInTheDocument();
      expect(screen.getByText('Test whats wrong')).toBeInTheDocument();
      expect(screen.queryByText('In the trace')).not.toBeInTheDocument();
      expect(screen.getByText('Possible cause')).toBeInTheDocument();
      expect(screen.getByText('Test possible cause')).toBeInTheDocument();
    });
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
      expect(screen.getByText("What's wrong")).toBeInTheDocument();
      expect(screen.getByText('Test whats wrong')).toBeInTheDocument();
    });
  });
});
