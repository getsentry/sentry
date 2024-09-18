import {AutofixDataFixture} from 'sentry-fixture/autofixData';
import {AutofixStepFixture} from 'sentry-fixture/autofixStep';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AutofixDrawer} from 'sentry/components/events/autofix/autofixDrawer';
import {t} from 'sentry/locale';

// Mock the hook used in the component
jest.mock('sentry/components/events/autofix/useAutofix', () => ({
  useAiAutofix: jest.fn(),
}));

describe('AutofixDrawer', () => {
  const mockEvent = EventFixture();
  const mockGroup = GroupFixture();
  const mockProject = ProjectFixture();

  const mockAutofixData = AutofixDataFixture({steps: [AutofixStepFixture()]});

  const mockTriggerAutofix = jest.fn();
  const mockReset = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    require('sentry/components/events/autofix/useAutofix').useAiAutofix.mockReturnValue({
      autofixData: null, // No data initially
      triggerAutofix: mockTriggerAutofix,
      reset: mockReset,
    });
  });

  it('renders properly', () => {
    render(<AutofixDrawer event={mockEvent} group={mockGroup} project={mockProject} />);

    expect(screen.getByText(mockGroup.shortId)).toBeInTheDocument();

    expect(screen.getByText(mockEvent.id)).toBeInTheDocument();

    expect(screen.getByRole('heading', {name: t('Autofix')})).toBeInTheDocument();

    expect(screen.getByText('Ready to begin analyzing the issue?')).toBeInTheDocument();

    const startButton = screen.getByRole('button', {name: 'Start'});
    expect(startButton).toBeInTheDocument();
  });

  it('triggers autofix on clicking the Start button', async () => {
    render(<AutofixDrawer event={mockEvent} group={mockGroup} project={mockProject} />);

    const startButton = screen.getByRole('button', {name: 'Start'});
    await userEvent.click(startButton);

    expect(mockTriggerAutofix).toHaveBeenCalledTimes(1);
  });

  it('displays autofix steps and Start Over button when autofixData is available', () => {
    require('sentry/components/events/autofix/useAutofix').useAiAutofix.mockReturnValue({
      autofixData: mockAutofixData,
      triggerAutofix: mockTriggerAutofix,
      reset: mockReset,
    });

    render(<AutofixDrawer event={mockEvent} group={mockGroup} project={mockProject} />);

    expect(screen.getByRole('button', {name: t('Start Over')})).toBeInTheDocument();
  });

  it('resets autofix on clicking the Start Over button', async () => {
    require('sentry/components/events/autofix/useAutofix').useAiAutofix.mockReturnValue({
      autofixData: mockAutofixData,
      triggerAutofix: mockTriggerAutofix,
      reset: mockReset,
    });

    render(<AutofixDrawer event={mockEvent} group={mockGroup} project={mockProject} />);

    const resetButton = screen.getByRole('button', {name: t('Start Over')});
    await userEvent.click(resetButton);

    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});
