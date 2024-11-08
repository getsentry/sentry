import {AutofixDataFixture} from 'sentry-fixture/autofixData';
import {AutofixStepFixture} from 'sentry-fixture/autofixStep';
import {EventFixture} from 'sentry-fixture/event';
import {FrameFixture} from 'sentry-fixture/frame';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {AutofixDrawer} from 'sentry/components/events/autofix/autofixDrawer';
import {t} from 'sentry/locale';
import {EntryType} from 'sentry/types/event';

describe('AutofixDrawer', () => {
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
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/summarize/`,
      method: 'POST',
      body: {
        hasGenAIConsent: true,
        data: {
          groupId: mockGroup.id,
          headline: 'Test headline',
          whatsWrong: 'You have a problem!',
          trace: 'You have other problems too...',
          possibleCause: "Maybe that's why.",
        },
      },
    });
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/setup/`,
      method: 'GET',
      body: {
        integration: {
          ok: true,
        },
        genAIConsent: {
          ok: true,
        },
        githubWriteIntegration: {
          ok: true,
        },
      },
    });
  });

  it('renders properly', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    render(<AutofixDrawer event={mockEvent} group={mockGroup} project={mockProject} />);

    expect(screen.getByText(mockGroup.shortId)).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByText(
          'Work together with Autofix to find the root cause and fix the issue.'
        )
      ).toBeInTheDocument();
    });

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

    render(<AutofixDrawer event={mockEvent} group={mockGroup} project={mockProject} />);

    const startButton = await screen.findByRole('button', {name: 'Start Autofix'});
    await userEvent.click(startButton);

    expect(
      await screen.findByRole('button', {name: t('Start Over')})
    ).toBeInTheDocument();
  });

  it('displays autofix steps and Start Over button when autofixData is available', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: mockAutofixData},
    });

    render(<AutofixDrawer event={mockEvent} group={mockGroup} project={mockProject} />);

    expect(
      await screen.findByRole('button', {name: t('Start Over')})
    ).toBeInTheDocument();
  });

  it('resets autofix on clicking the start over button', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: mockAutofixData},
    });

    render(<AutofixDrawer event={mockEvent} group={mockGroup} project={mockProject} />);

    const startOverButton = await screen.findByRole('button', {name: t('Start Over')});
    expect(startOverButton).toBeInTheDocument();
    await userEvent.click(startOverButton);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Work together with Autofix to find the root cause and fix the issue.'
        )
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Start Autofix'})).toBeInTheDocument();
    });
  });

  it('shows setup content when autofix is not setup', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/setup/`,
      method: 'GET',
      body: {
        integration: {
          ok: false,
          message: 'Integration not setup',
        },
        genAIConsent: {
          ok: false,
        },
        githubWriteIntegration: {
          ok: false,
          message: 'GitHub integration not setup',
          repos: [],
        },
      },
    });
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    render(<AutofixDrawer event={mockEvent} group={mockGroup} project={mockProject} />);

    expect(screen.getByText(mockGroup.shortId)).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Work together with Autofix to find the root cause and fix the issue.'
      )
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Start Autofix'})).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Set up Autofix')).toBeInTheDocument();
    });
  });
});
