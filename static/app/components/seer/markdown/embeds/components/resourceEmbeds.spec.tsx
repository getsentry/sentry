import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {ConfigStore} from 'sentry/stores/configStore';
import type {Config} from 'sentry/types/system';

function renderEmbed(name: string, data: Record<string, unknown>) {
  const raw = `{% ${name} %}${JSON.stringify(data)}{% /${name} %}`;
  return render(<SeerMarkdown raw={raw} />);
}

describe('Seer resource embeds', () => {
  let initialConfig: Config;

  beforeEach(() => {
    initialConfig = ConfigStore.getState();
  });

  afterEach(() => {
    ConfigStore.loadInitialData(initialConfig);
  });

  it('links a dashboard title to the dashboard in the current organization', async () => {
    const {router} = renderEmbed('dashboard', {
      id: '123',
      title: 'Application health',
    });

    await userEvent.click(screen.getByRole('link', {name: 'Application health'}));

    expect(router.location.pathname).toBe('/organizations/org-slug/dashboard/123/');
  });

  it('uses a dashboard fallback label and normalizes customer-domain links', () => {
    ConfigStore.set('customerDomain', {
      subdomain: 'org-slug',
      organizationUrl: 'https://org-slug.sentry.io',
      sentryUrl: 'https://sentry.io',
    });

    renderEmbed('dashboard', {id: '456'});

    expect(screen.getByRole('link', {name: 'Dashboard 456'})).toHaveAttribute(
      'href',
      '/dashboard/456/'
    );
  });

  it('links a replay to the relevant event timestamp', async () => {
    const {router} = renderEmbed('replay', {
      id: '4c1f2e3d1234567890',
      eventTimestamp: '2026-08-25T16:37:12Z',
    });

    await userEvent.click(screen.getByRole('link', {name: 'Replay 4c1f2e3d'}));

    expect(router.location.pathname).toBe(
      '/organizations/org-slug/explore/replays/4c1f2e3d1234567890/'
    );
    expect(router.location.query.event_t).toBe('2026-08-25T16:37:12Z');
  });

  it('links a replay without a timestamp to the beginning', () => {
    renderEmbed('replay', {id: 'abcdef1234567890'});

    expect(screen.getByRole('link', {name: 'Replay abcdef12'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/replays/abcdef1234567890/'
    );
  });
});
