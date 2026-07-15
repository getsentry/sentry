import type React from 'react';
import {useEffect, useState} from 'react';
import {Outlet, useLocation} from 'react-router-dom';
import {ThemeProvider} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {GlobalModal} from '@sentry/scraps/modal';

import Indicators from 'sentry/components/indicators';
import {ListLink} from 'sentry/components/links/listLink';
import {IconChevron, IconMenu, IconSentry, IconSliders} from 'sentry/icons';
import {ScrapsProviders} from 'sentry/scrapsProviders';
import {localStorageWrapper} from 'sentry/utils/localStorage';
// eslint-disable-next-line no-restricted-imports
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';
import {GlobalAlertProvider} from 'sentry/views/app/globalAlerts';
import {SystemAlerts} from 'sentry/views/app/systemAlerts';

import {GlobalStyles} from 'admin/globalStyles';

const ADMIN_SIDEBAR_COLLAPSED_KEY = 'getsentryAdminSidebarCollapsed';

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
  // Mobile: drawer open/closed
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Desktop: sidebar collapsed/expanded, persisted to localStorage
  const [isCollapsed, setIsCollapsed] = useState(
    () => localStorageWrapper.getItem(ADMIN_SIDEBAR_COLLAPSED_KEY) === 'true'
  );
  const location = useLocation();

  const closeSidebar = () => setSidebarOpen(false);

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorageWrapper.setItem(ADMIN_SIDEBAR_COLLAPSED_KEY, next ? 'true' : 'false');
  };

  // Close mobile drawer on route change.
  useEffect(() => {
    closeSidebar();
  }, [location.pathname]);

  // Close mobile drawer when the viewport widens past the mobile breakpoint,
  // so the body scroll lock is never left active on desktop.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!e.matches) {
        closeSidebar();
      }
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  // Lock body scroll while the mobile sidebar drawer is open.
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
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
          <AppContainer isCollapsed={isCollapsed}>
            {/* Mobile: tap-outside backdrop for the drawer */}
            <Overlay isOpen={sidebarOpen} onClick={closeSidebar} />
            {/* Desktop only: thin strip shown when sidebar is collapsed */}
            <CollapsedSidebar
              as="section"
              isCollapsed={isCollapsed}
              direction="column"
              align="center"
            >
              <Button
                aria-label="Expand sidebar"
                variant="transparent"
                size="sm"
                onClick={toggleCollapsed}
                icon={<IconChevron direction="right" isDouble />}
              />
            </CollapsedSidebar>
            <Sidebar isOpen={sidebarOpen} isCollapsed={isCollapsed}>
              <Flex align="center" justify="between" gap="md">
                <Logo to="/_admin/" onClick={closeSidebar}>
                  <IconSentry size="xl" />
                  Admin
                </Logo>
                {/* Desktop only: collapse button inside the sidebar */}
                <CollapseButton
                  aria-label="Collapse sidebar"
                  variant="transparent"
                  size="xs"
                  onClick={toggleCollapsed}
                  icon={<IconChevron direction="left" isDouble />}
                />
              </Flex>
              <Navigation
                onClick={(e: React.MouseEvent<HTMLUListElement>) => {
                  if ((e.target as HTMLElement).closest('a')) {
                    closeSidebar();
                  }
                }}
              >
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
                <NavLink to="/_admin/billing-platform/">Billing Platform</NavLink>
                <NavLink to="/_admin/gift-recurring-credits/">
                  Gift Recurring Credits
                </NavLink>
                <NavLink to="/_admin/spike-projection-generation/">
                  Spike Projection Generation
                </NavLink>
                <NavLink to="/_admin/launchpad/">Launchpad (Emerge) Related</NavLink>
                <NavLink to="/_admin/seer/">Seer</NavLink>
              </Navigation>
              <SidebarActions>
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
              </SidebarActions>
            </Sidebar>
            <Stack minWidth={0} inert={sidebarOpen || undefined}>
              {/* Mobile only: sticky top bar with hamburger and logo */}
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
            </Stack>
          </AppContainer>
        </GlobalAlertProvider>
      </ScrapsProviders>
    </ThemeProvider>
  );
}

// flow-root is used here to create a new flow-context, to avoid margin
// collapse causing scroll overflow.
const AppContainer = styled('div')<{isCollapsed: boolean}>`
  --contentWidth: 1270px;
  --sidebarWidth: 200px;
  --sidebarCollapsedWidth: 48px;

  display: flow-root;
  padding-left: ${p =>
    p.isCollapsed ? 'var(--sidebarCollapsedWidth)' : 'var(--sidebarWidth)'};
  transition: padding-left 0.2s ease;

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

const CollapsedSidebar = styled(Flex)<{isCollapsed: boolean}>`
  display: none;

  @media (min-width: 769px) {
    display: ${p => (p.isCollapsed ? 'flex' : 'none')};
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: var(--sidebarCollapsedWidth);
    padding-top: ${p => p.theme.space['2xl']};
    background: ${p => p.theme.tokens.background.primary};
    border-right: 1px solid ${p => p.theme.tokens.border.primary};
    z-index: 100;
  }
`;

const Sidebar = styled('section')<{isCollapsed?: boolean; isOpen?: boolean}>`
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
  /* Delay visibility until after the slide animation so hidden sidebar is
     removed from the tab order once off-screen. */
  visibility: ${p => (p.isCollapsed ? 'hidden' : 'visible')};
  transition:
    transform 0.2s ease,
    visibility 0s linear ${p => (p.isCollapsed ? '0.2s' : '0s')};

  /* Desktop: collapsed state slides off-screen */
  transform: translateX(${p => (p.isCollapsed ? '-100%' : '0')});

  > * {
    padding: 0 ${p => p.theme.space['3xl']};
  }

  /* Mobile: open state overrides desktop collapsed state */
  @media (max-width: 768px) {
    transform: translateX(${p => (p.isOpen ? '0' : '-100%')});
    visibility: ${p => (p.isOpen ? 'visible' : 'hidden')};
    transition:
      transform 0.2s ease,
      visibility 0s linear ${p => (p.isOpen ? '0s' : '0.2s')};
  }
`;

const SidebarActions = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${p => p.theme.space.md};
`;

const CollapseButton = styled(Button)`
  flex-shrink: 0;

  @media (max-width: 768px) {
    display: none;
  }
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
