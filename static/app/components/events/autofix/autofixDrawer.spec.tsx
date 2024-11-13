import {AutofixDataFixture} from 'sentry-fixture/autofixData';
import {AutofixStepFixture} from 'sentry-fixture/autofixStep';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {AutofixDrawer} from 'sentry/components/events/autofix/autofixDrawer';
import {t} from 'sentry/locale';

describe('AutofixDrawer', () => {
  const mockEvent = EventFixture();
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

    render(<AutofixDrawer event={mockEvent} group={mockGroup} project={mockProject} />);

    expect(screen.getByText(mockGroup.shortId)).toBeInTheDocument();

    expect(screen.getByText(mockEvent.id)).toBeInTheDocument();

    expect(screen.getAllByRole('heading', {name: 'Autofix'})[0]).toBeInTheDocument();

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
      expect(screen.getByRole('button', {name: 'Start Autofix'})).toBeInTheDocument();
    });
  });
});
