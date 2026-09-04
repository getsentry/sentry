import type {Config} from 'sentry/types/system';
import {ConfigStore} from 'sentry/stores/configStore';
import {getSettingsFieldSections} from 'sentry/views/settings/settingsCommandPaletteActions';

describe('getSettingsFieldSections', () => {
  let configState: Config;

  beforeEach(() => {
    configState = ConfigStore.getState();
  });

  afterEach(() => {
    ConfigStore.loadInitialData(configState);
  });

  it('includes the org slug in org-level route paths when not on a customer domain', () => {
    // No customerDomain set — normalizeUrl is a no-op, so the slug should be substituted.
    ConfigStore.set('customerDomain', null);

    const sections = getSettingsFieldSections('doogi');

    // At least one section should target an org-level settings path.
    const allPathnames = sections.flatMap(section =>
      section.fields.map(field => field.to.pathname)
    );
    const orgPaths = allPathnames.filter(p => p.startsWith('/settings/'));

    // Every org-level path must include the org slug and must NOT contain the literal `:orgId`.
    for (const pathname of orgPaths) {
      if (pathname.startsWith('/settings/account/')) {
        // Account-level routes never contain orgId.
        continue;
      }
      expect(pathname).toContain('doogi');
      expect(pathname).not.toContain(':orgId');
    }
  });

  it('does not include the org slug in org-level route paths when on a customer domain', () => {
    // With customerDomain set, normalizeUrl strips the orgId segment from the
    // template before the slug is substituted, so the resulting path should NOT
    // contain the real slug (the org is identified by the subdomain instead).
    ConfigStore.loadInitialData({
      ...configState,
      customerDomain: {
        subdomain: 'doogi',
        organizationUrl: 'https://doogi.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
    });

    const sections = getSettingsFieldSections('doogi');

    const allPathnames = sections.flatMap(section =>
      section.fields.map(field => field.to.pathname)
    );
    const orgPaths = allPathnames.filter(
      p => p.startsWith('/settings/') && !p.startsWith('/settings/account/')
    );

    // Org paths must not include the slug and must not contain `:orgId`.
    for (const pathname of orgPaths) {
      expect(pathname).not.toContain('doogi');
      expect(pathname).not.toContain(':orgId');
    }
  });
});
