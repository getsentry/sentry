import {BroadcastFixture} from 'sentry-fixture/broadcast';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {ModalStore} from 'sentry/stores/modalStore';
import * as intercom from 'sentry/utils/intercom';
import {
  PrimaryNavigationHelpMenu,
  useWhatsNewHelpMenuItem,
} from 'sentry/views/navigation/primary/helpMenu';

function HelpMenuWithWhatsNew() {
  const whatsNewOptions = useWhatsNewHelpMenuItem();
  return <PrimaryNavigationHelpMenu {...whatsNewOptions} />;
}

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
    ModalStore.reset();
    ConfigStore.set('supportEmail', 'support@sentry.io');
  });

  it('opens Intercom when contacting support', async () => {
    const organization = OrganizationFixture();

    render(<PrimaryNavigationHelpMenu />, {organization});

    await expandResourcesSubmenu();
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Contact Support'}));

    expect(intercom.showIntercom).toHaveBeenCalledWith(organization.slug);
  });

  it("updates What's New when broadcasts finish loading", async () => {
    const organization = OrganizationFixture();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/broadcasts/`,
      match: [MockApiClient.matchQuery({show: 'latest', limit: '3'})],
      asyncDelay: 100,
      body: [BroadcastFixture({id: '1', title: 'New Broadcast', hasSeen: true})],
    });

    render(<HelpMenuWithWhatsNew />, {organization});
    renderGlobalModal({organization});

    await userEvent.click(screen.getByRole('button', {name: 'Help'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: "What's New"}));

    expect(await screen.findByText('New Broadcast')).toBeInTheDocument();
  });
});
