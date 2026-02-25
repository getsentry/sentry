import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import * as intercom from 'sentry/utils/intercom';
import * as zendesk from 'sentry/utils/zendesk';
import {PrimaryNavigationHelp} from 'sentry/views/nav/primary/help';

jest.mock('sentry/utils/intercom', () => ({
  showIntercom: jest.fn(),
}));

jest.mock('sentry/utils/zendesk', () => ({
  hasZendesk: jest.fn(),
  activateZendesk: jest.fn(),
}));

jest.mock('sentry/views/nav/tour/tour', () => ({
  useStackedNavigationTour: jest.fn(() => ({
    startTour: jest.fn(),
  })),
  StackedNavigationTourReminder: ({children}: {children: React.ReactNode}) => (
    <div>{children}</div>
  ),
}));

describe('PrimaryNavigationHelp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ConfigStore.set('supportEmail', 'support@sentry.io');
  });

  it('opens Intercom when feature flag is enabled', async () => {
    const organization = OrganizationFixture({
      features: ['intercom-support'],
    });

    render(<PrimaryNavigationHelp />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Help'}));

    // Hover over "Get Help" to open submenu
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Get Help'}));

    // Click Contact Support in the submenu
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Contact Support'}));

    expect(intercom.showIntercom).toHaveBeenCalled();
    expect(zendesk.activateZendesk).not.toHaveBeenCalled();
  });

  it('opens Zendesk when feature flag is disabled and Zendesk is available', async () => {
    jest.mocked(zendesk.hasZendesk).mockReturnValue(true);

    const organization = OrganizationFixture({
      features: [],
    });

    render(<PrimaryNavigationHelp />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Help'}));

    // Hover over "Get Help" to open submenu
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Get Help'}));

    // Click Contact Support in the submenu
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Contact Support'}));

    expect(zendesk.activateZendesk).toHaveBeenCalled();
    expect(intercom.showIntercom).not.toHaveBeenCalled();
  });

  it('falls back to mailto when neither Intercom nor Zendesk is available', async () => {
    jest.mocked(zendesk.hasZendesk).mockReturnValue(false);

    const organization = OrganizationFixture({
      features: [],
    });

    render(<PrimaryNavigationHelp />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Help'}));

    // Hover over "Get Help" to open submenu
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Get Help'}));

    const contactSupport = screen.getByRole('menuitemradio', {name: 'Contact Support'});
    expect(contactSupport).toHaveAttribute('href', 'mailto:support@sentry.io');
  });
});
