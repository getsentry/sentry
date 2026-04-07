import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import * as intercom from 'sentry/utils/intercom';
import * as zendesk from 'sentry/utils/zendesk';
import {PrimaryNavigationHelpMenu} from 'sentry/views/navigation/primary/helpMenu';

jest.mock('sentry/utils/intercom', () => ({
  showIntercom: jest.fn(),
}));

jest.mock('sentry/utils/zendesk', () => ({
  hasZendesk: jest.fn(),
  activateZendesk: jest.fn(),
}));

jest.mock('sentry/views/navigation/navigationTour', () => ({
  useNavigationTour: jest.fn(() => ({
    startTour: jest.fn(),
  })),
  NavigationTourReminder: ({children}: {children: React.ReactNode}) => (
    <div>{children}</div>
  ),
}));

describe('PrimaryNavigationHelpMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ConfigStore.set('supportEmail', 'support@sentry.io');
  });

  it('opens Intercom when feature flag is enabled', async () => {
    const organization = OrganizationFixture({
      features: ['intercom-support'],
    });

    render(<PrimaryNavigationHelpMenu />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Help'}));

    // Click Contact Support in the menu
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Contact Support'}));

    expect(intercom.showIntercom).toHaveBeenCalledWith(organization.slug);
    expect(zendesk.activateZendesk).not.toHaveBeenCalled();
  });

  it('opens Zendesk when feature flag is disabled and Zendesk is available', async () => {
    jest.mocked(zendesk.hasZendesk).mockReturnValue(true);

    const organization = OrganizationFixture({
      features: [],
    });

    render(<PrimaryNavigationHelpMenu />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Help'}));

    // Click Contact Support in the menu
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Contact Support'}));

    expect(zendesk.activateZendesk).toHaveBeenCalled();
    expect(intercom.showIntercom).not.toHaveBeenCalled();
  });

  it('falls back to mailto when neither Intercom nor Zendesk is available', async () => {
    jest.mocked(zendesk.hasZendesk).mockReturnValue(false);

    const organization = OrganizationFixture({
      features: [],
    });

    render(<PrimaryNavigationHelpMenu />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Help'}));

    const contactSupport = screen.getByRole('menuitemradio', {name: 'Contact Support'});
    expect(contactSupport).toHaveAttribute('href', 'mailto:support@sentry.io');
  });
});
