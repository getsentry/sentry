import type {ReactNode} from 'react';
import {MemoryRouter} from 'react-router';
import {css, Global} from '@emotion/react';
import {IconBookmark} from '@sentry/icons/bookmark';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {Container} from '@sentry/scraps/layout';

import {OrganizationContext} from 'sentry/utils/organizationContext';
import {SECONDARY_SIDEBAR_WIDTH} from 'sentry/views/navigation/constants';
import {SecondaryNavigationContextProvider} from 'sentry/views/navigation/secondaryNavigationContext';

import {SecondaryNavigation} from './components';

type SettingsVersion = 'legacy' | 'settings-v3';

const SETTINGS_VERSIONS: SettingsVersion[] = ['legacy', 'settings-v3'];

function organizationFor(version: SettingsVersion) {
  return OrganizationFixture({
    slug: 'org-slug',
    features: version === 'settings-v3' ? ['settings-v3'] : [],
  });
}

interface SidebarFrameProps {
  children: ReactNode;
  pathname: string;
  version: SettingsVersion;
}

// The app's global stylesheet (static/css/base.css) removes the default link
// underline, but SSR snapshots don't load it.
/* oxlint-disable @sentry/scraps/no-dom-coupling -- Mirrors the app's global anchor reset, which SSR snapshots don't load. */
const linkReset = css`
  a {
    text-decoration: none;
  }
`;
/* oxlint-enable @sentry/scraps/no-dom-coupling */

/**
 * Renders the secondary navigation pieces inside the same width and background
 * as the real sidebar, without the resize handle and tour wrapper.
 */
function SidebarFrame({children, pathname, version}: SidebarFrameProps) {
  return (
    <MemoryRouter initialEntries={[pathname]}>
      <OrganizationContext value={organizationFor(version)}>
        <SecondaryNavigationContextProvider>
          <Global styles={linkReset} />
          <Container
            width={`${SECONDARY_SIDEBAR_WIDTH}px`}
            background="secondary"
            borderRight="primary"
          >
            {children}
          </Container>
        </SecondaryNavigationContextProvider>
      </OrganizationContext>
    </MemoryRouter>
  );
}

function SettingsNavigation() {
  return (
    <SecondaryNavigation.Body>
      <SecondaryNavigation.Section id="snapshot-organization" title="Organization">
        <SecondaryNavigation.List>
          <SecondaryNavigation.ListItem>
            <SecondaryNavigation.Link to="/settings/org-slug/" end>
              General Settings
            </SecondaryNavigation.Link>
          </SecondaryNavigation.ListItem>
          <SecondaryNavigation.ListItem>
            <SecondaryNavigation.Link to="/settings/org-slug/members/">
              Members
            </SecondaryNavigation.Link>
          </SecondaryNavigation.ListItem>
          <SecondaryNavigation.ListItem>
            <SecondaryNavigation.Link to="/settings/org-slug/teams/">
              Teams
            </SecondaryNavigation.Link>
          </SecondaryNavigation.ListItem>
        </SecondaryNavigation.List>
      </SecondaryNavigation.Section>
      <SecondaryNavigation.Separator />
      <SecondaryNavigation.Section
        id="snapshot-long-title"
        title="Developer Settings and Custom Integrations"
      >
        <SecondaryNavigation.List>
          <SecondaryNavigation.ListItem>
            <SecondaryNavigation.Link to="/settings/org-slug/auth-tokens/">
              Organization Tokens
            </SecondaryNavigation.Link>
          </SecondaryNavigation.ListItem>
          <SecondaryNavigation.ListItem>
            <SecondaryNavigation.Link to="/settings/org-slug/developer-settings/">
              Custom Integrations With A Very Long Name
            </SecondaryNavigation.Link>
          </SecondaryNavigation.ListItem>
        </SecondaryNavigation.List>
      </SecondaryNavigation.Section>
      <SecondaryNavigation.Section id="snapshot-untitled">
        <SecondaryNavigation.List>
          <SecondaryNavigation.ListItem>
            <SecondaryNavigation.Link to="/settings/org-slug/integrations/">
              Integrations
            </SecondaryNavigation.Link>
          </SecondaryNavigation.ListItem>
        </SecondaryNavigation.List>
      </SecondaryNavigation.Section>
    </SecondaryNavigation.Body>
  );
}

function ProductNavigation() {
  return (
    <SecondaryNavigation.Body>
      <SecondaryNavigation.Section id="snapshot-issues">
        <SecondaryNavigation.List>
          <SecondaryNavigation.ListItem>
            <SecondaryNavigation.Link to="/organizations/org-slug/issues/" end>
              Feed
            </SecondaryNavigation.Link>
          </SecondaryNavigation.ListItem>
          <SecondaryNavigation.ListItem>
            <SecondaryNavigation.Link to="/organizations/org-slug/issues/errors/">
              Errors & Outages
            </SecondaryNavigation.Link>
          </SecondaryNavigation.ListItem>
        </SecondaryNavigation.List>
      </SecondaryNavigation.Section>
      <SecondaryNavigation.Separator />
      <SecondaryNavigation.Section id="snapshot-views" title="Starred Views">
        <SecondaryNavigation.List>
          <SecondaryNavigation.ListItem>
            <SecondaryNavigation.Link
              to="/organizations/org-slug/issues/views/1/"
              leadingItems={<IconBookmark />}
            >
              Assigned to me
            </SecondaryNavigation.Link>
          </SecondaryNavigation.ListItem>
          <SecondaryNavigation.ListItem>
            <SecondaryNavigation.Link
              to="/organizations/org-slug/issues/views/2/"
              leadingItems={<IconBookmark />}
            >
              Unresolved regressions in production
            </SecondaryNavigation.Link>
          </SecondaryNavigation.ListItem>
        </SecondaryNavigation.List>
      </SecondaryNavigation.Section>
    </SecondaryNavigation.Body>
  );
}

describe('SecondaryNavigation', () => {
  // Settings is where collapsible section titles live, and where the title and
  // chevron once stacked onto two rows.
  it.snapshot.each<SettingsVersion>(SETTINGS_VERSIONS)(
    'settings-%s',
    version => (
      <SidebarFrame pathname="/settings/org-slug/members/" version={version}>
        <SecondaryNavigation.Header>
          <SecondaryNavigation.HeaderTitle>Settings</SecondaryNavigation.HeaderTitle>
        </SecondaryNavigation.Header>
        <SettingsNavigation />
      </SidebarFrame>
    ),
    version => ({tags: {area: 'core', nav: 'settings', version}})
  );

  it.snapshot.each<SettingsVersion>(SETTINGS_VERSIONS)(
    'issues-%s',
    version => (
      <SidebarFrame pathname="/organizations/org-slug/issues/" version={version}>
        <SecondaryNavigation.Header>
          <SecondaryNavigation.HeaderTitle>Issues</SecondaryNavigation.HeaderTitle>
        </SecondaryNavigation.Header>
        <ProductNavigation />
      </SidebarFrame>
    ),
    version => ({tags: {area: 'core', nav: 'issues', version}})
  );
});
