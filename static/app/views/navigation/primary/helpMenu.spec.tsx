import Cookies from 'js-cookie';
import {BroadcastFixture} from 'sentry-fixture/broadcast';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import {ConfigStore} from 'sentry/stores/configStore';
import {ModalStore} from 'sentry/stores/modalStore';
import {trackAnalytics} from 'sentry/utils/analytics';
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
jest.mock('sentry/utils/analytics');

describe('PrimaryNavigationHelpMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ModalStore.reset();
    ConfigStore.set('supportEmail', 'support@sentry.io');
    setWindowLocation('https://example.test');
    Cookies.remove('sentry_react_auth', {path: '/'});
  });

  afterEach(() => {
    Cookies.remove('sentry_react_auth', {path: '/'});
  });

  it('re-enables new login after an explicit opt-out and hides the item', async () => {
    const organization = OrganizationFixture();
    Cookies.set('sentry_react_auth', '0', {path: '/'});

    render(<PrimaryNavigationHelpMenu />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Help'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Enable new login'}));

    expect(Cookies.get('sentry_react_auth')).toBe('1');
    expect(trackAnalytics).toHaveBeenCalledWith('auth_v2.rollout.changed', {
      organization,
      source: 'help_menu',
      state: 'enabled',
    });

    await userEvent.click(screen.getByRole('button', {name: 'Help'}));

    expect(
      screen.queryByRole('menuitemradio', {name: /(?:Enable|Disable) new login/})
    ).not.toBeInTheDocument();
    expect(Cookies.get('sentry_react_auth')).toBe('1');
  });

  it('hides the new login item when the cookie is unset', async () => {
    render(<PrimaryNavigationHelpMenu />, {organization: OrganizationFixture()});

    await userEvent.click(screen.getByRole('button', {name: 'Help'}));

    expect(
      screen.queryByRole('menuitemradio', {name: 'Enable new login'})
    ).not.toBeInTheDocument();
  });

  it.each(['1', 'invalid', ''])(
    'hides the new login item for cookie %j',
    async cookie => {
      Cookies.set('sentry_react_auth', cookie, {path: '/'});
      render(<PrimaryNavigationHelpMenu />, {organization: OrganizationFixture()});

      await userEvent.click(screen.getByRole('button', {name: 'Help'}));

      expect(
        screen.queryByRole('menuitemradio', {name: /(?:Enable|Disable) new login/})
      ).not.toBeInTheDocument();
      expect(Cookies.get('sentry_react_auth')).toBe(cookie);
    }
  );

  it('opens Intercom when contacting support', async () => {
    const organization = OrganizationFixture();

    render(<PrimaryNavigationHelpMenu />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Help'}));
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
