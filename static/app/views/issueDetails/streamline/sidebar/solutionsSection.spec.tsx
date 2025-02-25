import {EventFixture} from 'sentry-fixture/event';
import {FrameFixture} from 'sentry-fixture/frame';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {EntryType} from 'sentry/types/event';
import {IssueCategory} from 'sentry/types/group';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import * as RegionUtils from 'sentry/utils/regions';
import SolutionsSection from 'sentry/views/issueDetails/streamline/sidebar/solutionsSection';
import {Tab} from 'sentry/views/issueDetails/types';

jest.mock('sentry/utils/issueTypeConfig');
jest.mock('sentry/utils/regions');

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
  const organization = OrganizationFixture({
    genAIConsent: true,
    hideAiFeatures: false,
    features: ['gen-ai-features'],
  });

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
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {
        steps: [],
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
        resolve: {enabled: true},
        resolveInRelease: {enabled: false},
        share: {enabled: false},
      },
      customCopy: {
        resolution: 'Resolved',
        eventUnits: 'Events',
      },
      pages: {
        landingPage: Tab.DETAILS,
        events: {enabled: false},
        openPeriods: {enabled: false},
        checkIns: {enabled: false},
        uptimeChecks: {enabled: false},
        attachments: {enabled: false},
        userFeedback: {enabled: false},
        replays: {enabled: false},
        tagsTab: {enabled: false},
      },
      detector: {enabled: false},
      autofix: true,
      discover: {enabled: false},
      eventAndUserCounts: {enabled: true},
      evidence: null,
      header: {
        filterBar: {enabled: true, fixedEnvironment: false},
        graph: {enabled: true, type: 'discover-events'},
        tagDistribution: {enabled: false},
        occurrenceSummary: {enabled: false},
      },
      logLevel: {enabled: true},
      mergedIssues: {enabled: false},
      performanceDurationRegression: {enabled: false},
      profilingDurationRegression: {enabled: false},
      regression: {enabled: false},
      showFeedbackWidget: false,
      similarIssues: {enabled: false},
      spanEvidence: {enabled: false},
      stacktrace: {enabled: false},
      stats: {enabled: false},
      tags: {enabled: false},
      useOpenPeriodChecks: false,
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
    expect(screen.getAllByTestId('loading-placeholder')).toHaveLength(2); // whatsWrong and Open Autofix
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
      features: ['gen-ai-features'],
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
    it('shows "Set Up Sentry AI" when AI needs setup', async () => {
      const customOrganization = OrganizationFixture({
        genAIConsent: false,
        hideAiFeatures: false,
        features: ['gen-ai-features'],
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

      expect(screen.getByRole('button', {name: 'Set Up Sentry AI'})).toBeInTheDocument();
    });

    it('shows "Find Root Cause" even when autofix needs setup', async () => {
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

      expect(screen.getByRole('button', {name: 'Find Root Cause'})).toBeInTheDocument();
    });

    it('shows "Find Root Cause" when autofix is available', async () => {
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
        expect(screen.getByRole('button', {name: 'Find Root Cause'})).toBeInTheDocument();
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

    it('does not show CTA button when region is de', () => {
      jest.mock('sentry/utils/regions');
      jest.mocked(RegionUtils.getRegionDataFromOrganization).mockImplementation(() => ({
        name: 'de',
        displayName: 'Europe (Frankfurt)',
        url: 'https://sentry.de.example.com',
      }));

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

      expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Set Up Sentry AI'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Set Up Autofix'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Find Root Cause'})
      ).not.toBeInTheDocument();
    });
  });
});
