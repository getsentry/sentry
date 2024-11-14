import {AutofixDataFixture} from 'sentry-fixture/autofixData';
import {AutofixStepFixture} from 'sentry-fixture/autofixStep';
import {EventFixture} from 'sentry-fixture/event';
import {FrameFixture} from 'sentry-fixture/frame';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {t} from 'sentry/locale';
import {EntryType} from 'sentry/types/event';
import {SolutionsHubDrawer} from 'sentry/views/issueDetails/streamline/solutionsHubDrawer';

describe('AutofixDrawer', () => {
  const organization = OrganizationFixture({genAIConsent: true, hideAiFeatures: false});

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

  it('renders properly', () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: mockAutofixData},
    });

    render(
      <SolutionsHubDrawer event={mockEvent} group={mockGroup} project={mockProject} />,
      {organization}
    );

    expect(screen.getByText(mockGroup.shortId)).toBeInTheDocument();

    expect(screen.getByText(mockEvent.id)).toBeInTheDocument();

    expect(screen.getByRole('heading', {name: 'Solutions Hub'})).toBeInTheDocument();

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

    const startButton = screen.getByRole('button', {name: 'Start Autofix'});
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

    render(
      <SolutionsHubDrawer event={mockEvent} group={mockGroup} project={mockProject} />,
      {organization}
    );

    expect(
      await screen.findByRole('button', {name: t('Start Over')})
    ).toBeInTheDocument();
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

    const startOverButton = await screen.findByRole('button', {name: t('Start Over')});
    expect(startOverButton).toBeInTheDocument();
    await userEvent.click(startOverButton);

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Start Autofix'})).toBeInTheDocument();
    });
  });
});
