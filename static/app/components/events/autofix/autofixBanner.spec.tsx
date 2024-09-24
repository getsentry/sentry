import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import {AutofixBanner} from 'sentry/components/events/autofix/autofixBanner';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';

jest.mock('sentry/utils/useIsSentryEmployee');
jest.mock('sentry/actionCreators/modal');

const mockGroup = GroupFixture();
const mockProject = ProjectFixture();
const mockEvent = EventFixture();

describe('AutofixBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useIsSentryEmployee as jest.Mock).mockReturnValue(false);
  });

  it('renders the banner with "Set up Autofix" button when setup is not done', () => {
    render(
      <AutofixBanner
        group={mockGroup}
        project={mockProject}
        event={mockEvent}
        hasSuccessfulSetup={false}
      />
    );

    expect(screen.getByText('Try Autofix')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Set up Autofix/i})).toBeInTheDocument();
  });

  it('renders the banner with "Open Autofix" button when setup is done', () => {
    render(
      <AutofixBanner
        group={mockGroup}
        project={mockProject}
        event={mockEvent}
        hasSuccessfulSetup
      />
    );

    expect(screen.getByText(/Try Autofix/i)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Open Autofix/i})).toBeInTheDocument();
  });

  it('opens the AutofixSetupModal when "Set up Autofix" is clicked', async () => {
    const mockOpenModal = jest.fn();
    (openModal as jest.Mock).mockImplementation(mockOpenModal);

    render(
      <AutofixBanner
        group={mockGroup}
        project={mockProject}
        event={mockEvent}
        hasSuccessfulSetup={false}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: /Set up Autofix/i}));
    expect(openModal).toHaveBeenCalled();
  });

  it('does not render PII message for non-Sentry employees', () => {
    render(
      <AutofixBanner
        group={mockGroup}
        project={mockProject}
        event={mockEvent}
        hasSuccessfulSetup
      />
    );

    expect(screen.queryByText(/By clicking the button above/i)).not.toBeInTheDocument();
  });

  it('renders PII message for Sentry employees when setup is successful', () => {
    (useIsSentryEmployee as jest.Mock).mockReturnValue(true);

    render(
      <AutofixBanner
        group={mockGroup}
        project={mockProject}
        event={mockEvent}
        hasSuccessfulSetup
      />
    );

    expect(screen.getByText(/By clicking the button above/i)).toBeInTheDocument();
  });
});
