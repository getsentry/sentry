import {useEffect, useState} from 'react';
import {Outlet, useLocation} from 'react-router-dom';
import {ThemeProvider} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {GlobalModal} from '@sentry/scraps/modal';

import Indicators from 'sentry/components/indicators';
import {ListLink} from 'sentry/components/links/listLink';
import {IconMenu, IconSentry, IconSliders} from 'sentry/icons';
import {ScrapsProviders} from 'sentry/scrapsProviders';
import {localStorageWrapper} from 'sentry/utils/localStorage';
// eslint-disable-next-line no-restricted-imports
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';
import {GlobalAlertProvider} from 'sentry/views/app/globalAlerts';
import {SystemAlerts} from 'sentry/views/app/systemAlerts';

import {GlobalStyles} from 'admin/globalStyles';

const themes = {
  darkTheme,
  lightTheme,
};

type ThemeName = keyof typeof themes;

const useToggleTheme = () => {
  const current = localStorageWrapper.getItem('getsentryAdminTheme') ?? 'lightTheme';
  const [themeName, setThemeName] = useState<ThemeName>(current as ThemeName);

  const toggleTheme = () => {
    const newThemeName = themeName === 'darkTheme' ? 'lightTheme' : 'darkTheme';
    setThemeName(newThemeName);
    localStorageWrapper.setItem('getsentryAdminTheme', newThemeName);
  };

  return [themeName === 'darkTheme', themes[themeName], toggleTheme] as const;
};

export function Layout() {
  const [isDark, theme, toggleTheme] = useToggleTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const closeSidebar = () => setSidebarOpen(false);

  // Close the sidebar on any route change (e.g. browser back/forward).
  useEffect(() => {
    closeSidebar();
  }, [location.pathname]);

  // Lock body scroll while the mobile sidebar drawer is open.
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  return (
    <ThemeProvider theme={theme}>
      <ScrapsProviders>
        <GlobalAlertProvider>
          <GlobalStyles theme={theme} />
          <GlobalModal />
          <SystemAlerts className="messages-container" />
          <Indicators className="indicators-container" />
          <AppContainer>
            <Overlay isOpen={sidebarOpen} onClick={closeSidebar} />
            <Sidebar isOpen={sidebarOpen}>
              <Logo to="/_admin/" onClick={closeSidebar}>
                <IconSentry size="xl" />
                Admin
              </Logo>
              <Navigation>
                <NavLink to="/_admin/" index onClick={closeSidebar}>
                  Home
                </NavLink>
                <NavLink to="/_admin/customers/" onClick={closeSidebar}>
                  Customers
                </NavLink>
                <NavLink to="/_admin/users/" onClick={closeSidebar}>
                  Users
                </NavLink>
                <NavLink to="/_admin/sentry-apps/" onClick={closeSidebar}>
                  Sentry Apps
                </NavLink>
                <NavLink to="/_admin/doc-integrations/" onClick={closeSidebar}>
                  Doc Integrations
                </NavLink>
                <NavLink to="/_admin/broadcasts/" onClick={closeSidebar}>
                  Broadcasts
                </NavLink>
                <NavLink to="/_admin/promocodes/" onClick={closeSidebar}>
                  Promos
                </NavLink>
                <NavLink to="/_admin/beacons/" onClick={closeSidebar}>
                  Beacons
                </NavLink>
                <NavLink to="/_admin/policies/" onClick={closeSidebar}>
                  Policies
                </NavLink>
                <NavLink to="/_admin/options/" onClick={closeSidebar}>
                  Options
                </NavLink>
                <NavLink to="/_admin/debugging-tools/" onClick={closeSidebar}>
                  Debugging Tools
                </NavLink>
                <NavLink to="/_admin/instance-level-oauth" onClick={closeSidebar}>
                  Instance level OAuth Clients
                </NavLink>
                <NavLink to="/_admin/private-apis/" onClick={closeSidebar}>
                  Private APIs
                </NavLink>
                <NavLink to="/_admin/relocations/" onClick={closeSidebar}>
                  Relocations
                </NavLink>
                <NavLink to="/_admin/employees/" onClick={closeSidebar}>
                  Sentry Employees
                </NavLink>
                <NavLink to="/_admin/billing-plans/" onClick={closeSidebar}>
                  Billing Plans
                </NavLink>
                <NavLink to="/_admin/invoices/" onClick={closeSidebar}>
                  Invoices
                </NavLink>
                <NavLink to="/_admin/billing-platform/" onClick={closeSidebar}>
                  Billing Platform
                </NavLink>
                <NavLink to="/_admin/spike-projection-generation/" onClick={closeSidebar}>
                  Spike Projection Generation
                </NavLink>
                <NavLink to="/_admin/launchpad/" onClick={closeSidebar}>
                  Launchpad (Emerge) Related
                </NavLink>
                <NavLink to="/_admin/seer/" onClick={closeSidebar}>
                  Seer
                </NavLink>
              </Navigation>
              <div>
                <ThemeToggle
                  variant="transparent"
                  size="zero"
                  onClick={toggleTheme}
                  icon={
                    <IconSliders
                      size="sm"
                      style={{transform: isDark ? 'scaleX(-1)' : 'none'}}
                    />
                  }
                >
                  {isDark ? 'Light mode' : 'Dark mode'}
                </ThemeToggle>
              </div>
            </Sidebar>
            <MainArea>
              <MobileTopBar>
                <Button
                  variant="transparent"
                  size="sm"
                  icon={<IconMenu />}
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open navigation"
                />
                <MobileLogo to="/_admin/">
                  <IconSentry size="md" />
                  Admin
                </MobileLogo>
              </MobileTopBar>
              <Container
                as="main"
                padding="0 2xl"
                width="100%"
                maxWidth="var(--contentWidth)"
              >
                <Outlet />
              </Container>
            </MainArea>
          </AppContainer>
        </GlobalAlertProvider>
      </ScrapsProviders>
    </ThemeProvider>
  );
}

// flow-root is used here to create a new flow-context, to avoid margin
// collapse causing scroll overflow.
const AppContainer = styled('div')`
  --contentWidth: 1270px;
  --sidebarWidth: 200px;

  display: flow-root;
  padding-left: var(--sidebarWidth);

  @media (max-width: 768px) {
    padding-left: 0;
  }
`;

const Overlay = styled('div')<{isOpen: boolean}>`
  display: none;

  @media (max-width: 768px) {
    display: ${p => (p.isOpen ? 'block' : 'none')};
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 99;
  }
`;

const Sidebar = styled('section')<{isOpen?: boolean}>`
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  display: grid;
  grid-template-rows: max-content 1fr max-content;
  width: var(--sidebarWidth);
  padding: ${p => p.theme.space['2xl']} 0;
  gap: ${p => p.theme.space['2xl']};
  background: ${p => p.theme.tokens.background.primary};
  border-right: 1px solid ${p => p.theme.tokens.border.primary};
  z-index: 100;

  > * {
    padding: 0 ${p => p.theme.space['3xl']};
  }

  @media (max-width: 768px) {
    transform: translateX(${p => (p.isOpen ? '0' : '-100%')});
    transition: transform 0.2s ease;
  }
`;

const MainArea = styled('div')`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const MobileTopBar = styled('div')`
  display: none;

  @media (max-width: 768px) {
    display: flex;
    align-items: center;
    gap: ${p => p.theme.space.md};
    padding: ${p => p.theme.space.sm} ${p => p.theme.space.lg};
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
    background: ${p => p.theme.tokens.background.primary};
    position: sticky;
    top: 0;
    z-index: 10;
  }
`;

const MobileLogo = styled(Link)`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  text-transform: uppercase;
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.lg};
  font-weight: bold;
`;

const Logo = styled(Link)`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  text-transform: uppercase;
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.xl};
  font-weight: bold;
`;

const ThemeToggle = styled(Button)`
  text-transform: uppercase;
  font-size: ${p => p.theme.font.size.sm};
  font-weight: bold;
  color: ${p => p.theme.tokens.content.secondary};
`;

const Navigation = styled('ul')`
  display: flex;
  flex-direction: column;
  list-style: none;
  font-size: ${p => p.theme.font.size.md};
  margin: 0;
  overflow-y: auto;
  gap: ${p => p.theme.space['2xs']};
`;

const NavLink = styled(ListLink)`
  --activeIndicatorWidth: ${p => p.theme.space.xs};

  padding: ${p => p.theme.space['2xs']} 0;
  color: ${p => p.theme.tokens.content.primary};
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};

  .active & {
    color: ${p => p.theme.tokens.interactive.link.accent.active};
    margin-left: calc(-1 * (${p => p.theme.space.md} + var(--activeIndicatorWidth)));
  }

  .active &::before {
    display: block;
    content: '';
    width: var(--activeIndicatorWidth);
    height: ${p => p.theme.space['2xl']};
    position: relative;
    top: -1px;
    color: ${p => p.theme.tokens.interactive.link.accent.active};
    background: currentColor;
  }

  &:hover {
    color: ${p => p.theme.tokens.interactive.link.accent.active};
  }
`;
