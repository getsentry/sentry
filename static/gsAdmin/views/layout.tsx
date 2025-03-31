import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import GlobalModal from 'sentry/components/globalModal';
import Indicators from 'sentry/components/indicators';
import Link from 'sentry/components/links/link';
import ListLink from 'sentry/components/links/listLink';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {IconSentry, IconSliders} from 'sentry/icons';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import SystemAlerts from 'sentry/views/app/systemAlerts';

type Props = {
  children: React.ReactNode;
};

function Layout({children}: Props) {
  const config = useLegacyStore(ConfigStore);

  return (
    <ThemeAndStyleProvider>
      <GlobalModal />
      <SystemAlerts className="messages-container" />
      <Indicators className="indicators-container" />
      <AppContainer>
        <Sidebar>
          <Logo to="/_admin/">
            <IconSentry size="xl" />
            Admin
          </Logo>
          <Navigation>
            <NavLink to="/_admin/" index>
              Home
            </NavLink>
            <NavLink to="/_admin/customers/">Customers</NavLink>
            <NavLink to="/_admin/users/">Users</NavLink>
            <NavLink to="/_admin/sentry-apps/">Sentry Apps</NavLink>
            <NavLink to="/_admin/doc-integrations/">Doc Integrations</NavLink>
            <NavLink to="/_admin/broadcasts/">Broadcasts</NavLink>
            <NavLink to="/_admin/promocodes/">Promos</NavLink>
            <NavLink to="/_admin/beacons/">Beacons</NavLink>
            <NavLink to="/_admin/policies/">Policies</NavLink>
            <NavLink to="/_admin/options/">Options</NavLink>
            <NavLink to="/_admin/debugging-tools/">Debugging Tools</NavLink>
            <NavLink to="/_admin/instance-level-oauth">
              Instance level OAuth Clients
            </NavLink>
            <NavLink to="/_admin/private-apis/">Private APIs</NavLink>
            <NavLink to="/_admin/relocations/">Relocations</NavLink>
            <NavLink to="/_admin/employees/">Sentry Employees</NavLink>
            <NavLink to="/_admin/billing-plans/">Billing Plans</NavLink>
            <NavLink to="/_admin/invoices/">Invoices</NavLink>
          </Navigation>
          <div>
            <ThemeToggle
              borderless
              size="zero"
              onClick={() =>
                ConfigStore.set('theme', config.theme === 'dark' ? 'light' : 'dark')
              }
              icon={
                <IconSliders
                  size="sm"
                  style={{transform: config.theme === 'dark' ? 'scaleX(-1)' : 'none'}}
                />
              }
            >
              {config.theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </ThemeToggle>
          </div>
        </Sidebar>
        <Content>{children}</Content>
      </AppContainer>
    </ThemeAndStyleProvider>
  );
}

// flow-root is used here to create a new flow-context, to avoid margin
// collapse causing scroll overflow.
const AppContainer = styled('div')`
  --contentWidth: 1270px;
  --sidebarWidth: 200px;

  display: flow-root;
  padding-left: var(--sidebarWidth);
`;

const Content = styled(`main`)`
  width: 100%;
  max-width: var(--contentWidth);
  padding: 0 ${space(3)};
`;

const Sidebar = styled('section')`
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  display: grid;
  grid-template-rows: max-content 1fr max-content;
  width: var(--sidebarWidth);
  padding: ${space(3)} 0;
  gap: ${space(3)};
  background: ${p => p.theme.background};
  border-right: 1px solid ${p => p.theme.border};

  > * {
    padding: 0 ${space(4)};
  }
`;

const Logo = styled(Link)`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  text-transform: uppercase;
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: bold;
`;

const ThemeToggle = styled(Button)`
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: bold;
  color: ${p => p.theme.subText};
`;

const Navigation = styled('ul')`
  display: flex;
  flex-direction: column;
  list-style: none;
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
  overflow-y: auto;
  gap: ${space(0.25)};
`;

const NavLink = styled(ListLink)`
  --activeIndicatorWidth: ${space(0.5)};

  padding: ${space(0.25)} 0;
  color: ${p => p.theme.textColor};
  display: flex;
  align-items: center;
  gap: ${space(1)};

  .active & {
    color: ${p => p.theme.active};
    margin-left: calc(-1 * (${space(1)} + var(--activeIndicatorWidth)));
  }

  .active &::before {
    display: block;
    content: '';
    width: var(--activeIndicatorWidth);
    height: ${space(3)};
    position: relative;
    top: -1px;
    background: ${p => p.theme.active};
  }

  &:hover {
    color: ${p => p.theme.active};
  }
`;

export default Layout;
