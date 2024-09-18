import {AutofixDataFixture} from 'sentry-fixture/autofixData';
import {AutofixStepFixture} from 'sentry-fixture/autofixStep';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {AutofixDrawer} from 'sentry/components/events/autofix/autofixDrawer';
import {t} from 'sentry/locale';

describe('AutofixDrawer', () => {
  const mockEvent = EventFixture();
  const mockGroup = GroupFixture();
  const mockProject = ProjectFixture();

  const mockAutofixData = AutofixDataFixture({steps: [AutofixStepFixture()]});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders properly', () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: mockAutofixData},
    });

    render(<AutofixDrawer event={mockEvent} group={mockGroup} project={mockProject} />);

    expect(screen.getByText(mockGroup.shortId)).toBeInTheDocument();

    expect(screen.getByText(mockEvent.id)).toBeInTheDocument();

    expect(screen.getByRole('heading', {name: t('Autofix')})).toBeInTheDocument();

    expect(screen.getByText('Ready to begin analyzing the issue?')).toBeInTheDocument();

    const startButton = screen.getByRole('button', {name: 'Start'});
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

    const startButton = screen.getByRole('button', {name: 'Start'});
    act(() => {
      userEvent.click(startButton);
    });

    await expect(
      screen.findByRole('button', {name: t('Start Over')})
    ).resolves.toBeInTheDocument();
  });

  it('displays autofix steps and Start Over button when autofixData is available', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: mockAutofixData},
    });

    render(<AutofixDrawer event={mockEvent} group={mockGroup} project={mockProject} />);

    await expect(
      screen.findByRole('button', {name: t('Start Over')})
    ).resolves.toBeInTheDocument();
  });

  it('resets autofix on clicking the start over button', () => {
    MockApiClient.addMockResponse({
      url: `/issues/${mockGroup.id}/autofix/`,
      body: {autofix: mockAutofixData},
    });

    render(<AutofixDrawer event={mockEvent} group={mockGroup} project={mockProject} />);

    waitFor(() => {
      const startOverButton = screen.getByRole('button', {name: t('Start Over')});
      expect(startOverButton).toBeInTheDocument();
      userEvent.click(startOverButton);
    });

    waitFor(() => {
      expect(screen.getByText('Ready to begin analyzing the issue?')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Start'})).toBeInTheDocument();
    });
  });
});
