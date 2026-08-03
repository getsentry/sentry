import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import * as intercom from 'sentry/utils/intercom';
import {PrimaryNavigationHelpMenu} from 'sentry/views/navigation/primary/helpMenu';

jest.mock('sentry/utils/intercom', () => ({
  showIntercom: jest.fn(),
}));

async function expandResourcesSubmenu() {
  await userEvent.click(screen.getByRole('button', {name: 'Help'}));
  await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Resources'}));
}

describe('PrimaryNavigationHelpMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ConfigStore.set('supportEmail', 'support@sentry.io');
  });

  it('opens Intercom when contacting support', async () => {
    const organization = OrganizationFixture();

    render(<PrimaryNavigationHelpMenu />, {organization});

    await expandResourcesSubmenu();
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Contact Support'}));

    expect(intercom.showIntercom).toHaveBeenCalledWith(organization.slug);
  });
});
