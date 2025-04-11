import {EventFixture} from 'sentry-fixture/event';
import {FrameFixture} from 'sentry-fixture/frame';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {EntryType} from 'sentry/types/event';
import {type Group, IssueCategory} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import SeerSection from 'sentry/views/issueDetails/streamline/sidebar/seerSection';

jest.mock('sentry/utils/regions');

describe('SeerSection', () => {
  const mockEvent = EventFixture({
    entries: [
      {
        type: EntryType.EXCEPTION,
        data: {values: [{stacktrace: {frames: [FrameFixture()]}}]},
      },
    ],
  });
  let mockGroup!: ReturnType<typeof GroupFixture>;
  const mockProject = ProjectFixture();
  const organization = OrganizationFixture({
    genAIConsent: true,
    hideAiFeatures: false,
    features: ['gen-ai-features'],
  });

  beforeEach(() => {
    mockGroup = GroupFixture();
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
      body: {steps: []},
    });
  });

  it('renders summary when AI features are enabled and data is available', async () => {
    const mockSummary = 'This is a test summary';
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/summarize/`,
      method: 'POST',
      body: {whatsWrong: mockSummary},
    });

    render(<SeerSection event={mockEvent} group={mockGroup} project={mockProject} />, {
      organization,
    });

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

    const disabledIssueSummaryGroup: Group = {
      ...mockGroup,
      issueCategory: IssueCategory.PERFORMANCE,
      title: 'ChunkLoadError',
      platform: 'javascript',
    };

    const javascriptProject: Project = {...mockProject, platform: 'javascript'};

    render(
      <SeerSection
        event={mockEvent}
        group={disabledIssueSummaryGroup}
        project={javascriptProject}
      />,
      {organization: customOrganization}
    );

    expect(screen.getByText('Resources')).toBeInTheDocument();

    expect(
      screen.getByRole('button', {name: 'How to fix ChunkLoadErrors'})
    ).toBeInTheDocument();
  });

  describe('Seer button text', () => {
    it('shows "Set Up Autofix" when AI needs setup', async () => {
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

      render(<SeerSection event={mockEvent} group={mockGroup} project={mockProject} />, {
        organization: customOrganization,
      });

      await waitFor(() => {
        expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
      });

      expect(
        screen.getByText('Explore potential root causes and solutions with Autofix.')
      ).toBeInTheDocument();

      expect(screen.getByRole('button', {name: 'Set Up Autofix'})).toBeInTheDocument();
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
        body: {whatsWrong: 'Test summary'},
      });

      render(<SeerSection event={mockEvent} group={mockGroup} project={mockProject} />, {
        organization,
      });

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
        body: {whatsWrong: 'Test summary'},
      });

      render(<SeerSection event={mockEvent} group={mockGroup} project={mockProject} />, {
        organization,
      });

      await waitFor(() => {
        expect(screen.getByRole('button', {name: 'Find Root Cause'})).toBeInTheDocument();
      });
    });

    it('shows resource link when available', () => {
      const disabledIssueSummaryGroup: Group = {
        ...mockGroup,
        issueCategory: IssueCategory.PERFORMANCE,
        title: 'ChunkLoadError',
        platform: 'javascript',
      };

      const javascriptProject: Project = {...mockProject, platform: 'javascript'};

      // Mock config with autofix disabled
      MockApiClient.addMockResponse({
        url: `/issues/${mockGroup.id}/autofix/setup/`,
        body: {
          genAIConsent: {ok: true},
          integration: {ok: true},
          githubWriteIntegration: {ok: true},
        },
      });

      render(
        <SeerSection
          event={mockEvent}
          group={disabledIssueSummaryGroup}
          project={javascriptProject}
        />,
        {organization}
      );

      expect(
        screen.getByRole('button', {name: 'How to fix ChunkLoadErrors'})
      ).toBeInTheDocument();
    });
  });
});
