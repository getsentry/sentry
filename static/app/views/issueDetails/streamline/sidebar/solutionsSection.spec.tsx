import {EventFixture} from 'sentry-fixture/event';
import {FrameFixture} from 'sentry-fixture/frame';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {EntryType} from 'sentry/types/event';
import {IssueCategory} from 'sentry/types/group';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import SolutionsSection from 'sentry/views/issueDetails/streamline/sidebar/solutionsSection';

jest.mock('sentry/utils/issueTypeConfig');

describe('SolutionsSection', () => {
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
  const organization = OrganizationFixture({genAIConsent: true, hideAiFeatures: false});

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

    jest.mocked(getConfigForIssueType).mockReturnValue({
      issueSummary: {
        enabled: true,
      },
      resources: {
        description: 'Test Resource',
        links: [{link: 'https://example.com', text: 'Test Link'}],
        linksByPlatform: {},
      },
      actions: {
        archiveUntilOccurrence: {enabled: false},
        delete: {enabled: false},
        deleteAndDiscard: {enabled: false},
        ignore: {enabled: false},
        merge: {enabled: false},
        resolveInRelease: {enabled: false},
        share: {enabled: false},
      },
      attachments: {enabled: false},
      autofix: true,
      discover: {enabled: false},
      events: {enabled: false},
      evidence: null,
      filterAndSearchHeader: {enabled: false},
      mergedIssues: {enabled: false},
      performanceDurationRegression: {enabled: false},
      profilingDurationRegression: {enabled: false},
      regression: {enabled: false},
      replays: {enabled: false},
      showFeedbackWidget: false,
      similarIssues: {enabled: false},
      spanEvidence: {enabled: false},
      stacktrace: {enabled: false},
      stats: {enabled: false},
      tags: {enabled: false},
      tagsTab: {enabled: false},
      userFeedback: {enabled: false},
      usesIssuePlatform: false,
    });
  });

  it('renders loading state when summary is pending', () => {
    // Use a delayed response to simulate loading state
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/summarize/`,
      method: 'POST',
      statusCode: 200,
      body: new Promise(() => {}), // Never resolves, keeping the loading state
    });

    render(
      <SolutionsSection event={mockEvent} group={mockGroup} project={mockProject} />,
      {
        organization,
      }
    );

    expect(screen.getByText('Solutions Hub')).toBeInTheDocument();
    expect(screen.getAllByTestId('loading-placeholder')).toHaveLength(3);
  });

  it('renders summary when AI features are enabled and data is available', async () => {
    const mockSummary = 'This is a test summary';
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/summarize/`,
      method: 'POST',
      body: {
        whatsWrong: mockSummary,
      },
    });

    render(
      <SolutionsSection event={mockEvent} group={mockGroup} project={mockProject} />,
      {
        organization,
      }
    );

    await waitFor(() => {
      expect(screen.getByText(mockSummary)).toBeInTheDocument();
    });
  });

  it('renders resources section when AI features are disabled', () => {
    const customOrganization = OrganizationFixture({
      hideAiFeatures: true,
      genAIConsent: false,
    });

    render(
      <SolutionsSection event={mockEvent} group={mockGroup} project={mockProject} />,
      {
        organization: customOrganization,
      }
    );

    expect(screen.getByText('Test Link')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'READ MORE'})).toBeInTheDocument();
  });

  it('toggles resources content when clicking Read More/Show Less', async () => {
    const customOrganization = OrganizationFixture({
      hideAiFeatures: true,
      genAIConsent: false,
    });

    render(
      <SolutionsSection event={mockEvent} group={mockGroup} project={mockProject} />,
      {
        organization: customOrganization,
      }
    );

    const readMoreButton = screen.getByRole('button', {name: 'READ MORE'});
    await userEvent.click(readMoreButton);

    expect(screen.getByRole('button', {name: 'SHOW LESS'})).toBeInTheDocument();

    const showLessButton = screen.getByRole('button', {name: 'SHOW LESS'});
    await userEvent.click(showLessButton);

    expect(screen.queryByRole('button', {name: 'SHOW LESS'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'READ MORE'})).toBeInTheDocument();
  });

  describe('Solutions Hub button text', () => {
    it('shows "Set up Sentry AI" when AI needs setup', async () => {
      const customOrganization = OrganizationFixture({
        genAIConsent: false,
        hideAiFeatures: false,
      });

      MockApiClient.addMockResponse({
        url: `/issues/${mockGroup.id}/autofix/setup/`,
        body: {
          genAIConsent: {ok: false},
          integration: {ok: false},
          githubWriteIntegration: {ok: false},
        },
      });

      render(
        <SolutionsSection event={mockEvent} group={mockGroup} project={mockProject} />,
        {
          organization: customOrganization,
        }
      );

      await waitFor(() => {
        expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
      });

      expect(
        screen.getByText('Explore potential root causes and solutions with Sentry AI.')
      ).toBeInTheDocument();

      expect(screen.getByRole('button', {name: 'Set up Sentry AI'})).toBeInTheDocument();
    });

    it('shows "Set up Autofix" when autofix needs setup', async () => {
      MockApiClient.addMockResponse({
        url: `/issues/${mockGroup.id}/autofix/setup/`,
        body: {
          genAIConsent: {ok: true},
          integration: {ok: false},
          githubWriteIntegration: {ok: false},
        },
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/summarize/`,
        method: 'POST',
        body: {
          whatsWrong: 'Test summary',
        },
      });

      render(
        <SolutionsSection event={mockEvent} group={mockGroup} project={mockProject} />,
        {
          organization,
        }
      );

      await waitFor(() => {
        expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
      });

      expect(screen.getByRole('button', {name: 'Set up Autofix'})).toBeInTheDocument();
    });

    it('shows "Open Resources & Autofix" when both are available', async () => {
      // Mock successful summary response
      MockApiClient.addMockResponse({
        url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/summarize/`,
        method: 'POST',
        body: {
          whatsWrong: 'Test summary',
        },
      });

      // Mock successful autofix setup
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
          whatsWrong: 'Test summary',
        },
      });

      render(
        <SolutionsSection event={mockEvent} group={mockGroup} project={mockProject} />,
        {
          organization,
        }
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', {name: 'Open Resources & Autofix'})
        ).toBeInTheDocument();
      });
    });

    it('shows "Open Autofix" when only autofix is available', async () => {
      // Mock successful autofix setup but disable resources
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
          whatsWrong: 'Test summary',
        },
      });

      jest.mocked(getConfigForIssueType).mockReturnValue({
        ...jest.mocked(getConfigForIssueType)(mockGroup, mockGroup.project),
        resources: null,
      });

      render(
        <SolutionsSection event={mockEvent} group={mockGroup} project={mockProject} />,
        {
          organization,
        }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', {name: 'Open Autofix'})).toBeInTheDocument();
      });
    });

    it('shows "READ MORE" when only resources are available', async () => {
      mockGroup.issueCategory = IssueCategory.UPTIME;

      // Mock config with autofix disabled
      MockApiClient.addMockResponse({
        url: `/issues/${mockGroup.id}/autofix/setup/`,
        body: {
          genAIConsent: {ok: true},
          integration: {ok: true},
          githubWriteIntegration: {ok: true},
        },
      });

      jest.mocked(getConfigForIssueType).mockReturnValue({
        ...jest.mocked(getConfigForIssueType)(mockGroup, mockGroup.project),
        autofix: false,
        issueSummary: {enabled: false},
        resources: {
          description: '',
          links: [],
          linksByPlatform: {},
        },
      });

      render(
        <SolutionsSection event={mockEvent} group={mockGroup} project={mockProject} />,
        {
          organization,
        }
      );

      await waitFor(() => {
        expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
      });

      expect(screen.getByRole('button', {name: 'READ MORE'})).toBeInTheDocument();
    });
  });
});
