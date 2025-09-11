import {isValidElement, useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {IconClose, IconMenu} from 'sentry/icons';
import {t} from 'sentry/locale';
import {fadeIn, slideInLeft} from 'sentry/styles/animations';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {usePrefersStackedNav} from 'sentry/views/nav/usePrefersStackedNav';
import SettingsBreadcrumb from 'sentry/views/settings/components/settingsBreadcrumb';
import SettingsHeader from 'sentry/views/settings/components/settingsHeader';
import SettingsSearch from 'sentry/views/settings/components/settingsSearch';
import OrganizationSettingsLayout from 'sentry/views/settings/organization/organizationSettingsLayout';
import OrganizationSettingsNavigation from 'sentry/views/settings/organization/organizationSettingsNavigation';

import {hasNewBillingUI} from 'getsentry/utils/billing';

type Props = {
  children: React.ReactNode;
} & RouteComponentProps;

function SubscriptionSettingsLayout(props: Props) {
  const prefersStackedNav = usePrefersStackedNav();
  const organization = useOrganization();
  const isNewBillingUI = hasNewBillingUI(organization);

  // This is used when the screen is small enough that the navigation should be
  // hidden. This state is only used when the media query matches.
  //
  // [!!] On large screens this state is totally unused!
  const [isMobileNavVisible, setMobileNavVisible] = useState(false);

  // Offset mobile settings navigation by the height of main navigation,
  // settings breadcrumbs and optional warnings.
  const [navOffsetTop, setNavOffsetTop] = useState(0);

  const headerRef = useRef<HTMLDivElement>(null);

  const location = useLocation();

  const toggleNav = useCallback((visible: boolean) => {
    const bodyElement = document.getElementsByTagName('body')[0]!;

    window.scrollTo?.(0, 0);
    bodyElement.classList[visible ? 'add' : 'remove']('scroll-lock');

    setMobileNavVisible(visible);
    setNavOffsetTop(headerRef.current?.getBoundingClientRect().bottom ?? 0);
  }, []);

  // Close menu when navigating away
  useEffect(() => toggleNav(false), [toggleNav, location.pathname]);

  const {children, params, routes, route} = props;

  // We want child's view's props
  const childProps =
    children && isValidElement(children) ? (children.props as Props) : props;
  const childRoutes = childProps.routes || routes || [];
  const childRoute = childProps.route || route || {};
  const renderNavigation = prefersStackedNav
    ? undefined
    : () => <OrganizationSettingsNavigation />;
  const shouldRenderNavigation = typeof renderNavigation === 'function';

  if (isNewBillingUI) {
    return (
      <Flex direction="column" flex={1} minWidth="0">
        <StyledSettingsHeader ref={headerRef}>
          <Flex align="center" justify="between">
            {shouldRenderNavigation && (
              <NavMenuToggle
                priority="link"
                aria-label={isMobileNavVisible ? t('Close the menu') : t('Open the menu')}
                icon={
                  isMobileNavVisible ? (
                    <IconClose aria-hidden />
                  ) : (
                    <IconMenu aria-hidden />
                  )
                }
                onClick={() => toggleNav(!isMobileNavVisible)}
              />
            )}
            <StyledSettingsBreadcrumb
              params={params}
              routes={childRoutes}
              route={childRoute}
            />
            <SettingsSearch />
          </Flex>
        </StyledSettingsHeader>

        <Flex maxWidth={'1440px'} flex="1">
          {shouldRenderNavigation && (
            <SidebarWrapper
              aria-label={t('Settings Navigation')}
              isVisible={isMobileNavVisible}
              offsetTop={navOffsetTop}
            >
              {renderNavigation()}
            </SidebarWrapper>
          )}
          <NavMask isVisible={isMobileNavVisible} onClick={() => toggleNav(false)} />
          <Content>{children}</Content>
        </Flex>
      </Flex>
    );
  }

  return <OrganizationSettingsLayout {...props} />;
}

export default SubscriptionSettingsLayout;

const NavMenuToggle = styled(Button)`
  display: none;
  margin: ${p =>
    `-${p.theme.space.md} ${p.theme.space.md} -${p.theme.space.md} -${p.theme.space.md}`};
  padding: ${p => p.theme.space.md};
  color: ${p => p.theme.subText};
  &:hover,
  &:focus,
  &:active {
    color: ${p => p.theme.textColor};
  }
  @media (max-width: ${p => p.theme.breakpoints.md}) {
    display: block;
  }
`;

const StyledSettingsBreadcrumb = styled(SettingsBreadcrumb)`
  flex: 1;
`;

const SidebarWrapper = styled('nav')<{isVisible: boolean; offsetTop: number}>`
  flex-shrink: 0;
  /* @TODO(jonasbadalic) 220px used to be defined as theme.settings.sidebarWidth and only used here */
  width: 220px;
  background: ${p => p.theme.background};
  border-right: 1px solid ${p => p.theme.border};

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    display: ${p => (p.isVisible ? 'block' : 'none')};
    position: fixed;
    top: ${p => p.offsetTop}px;
    bottom: 0;
    overflow-y: auto;
    animation: ${slideInLeft} 100ms ease-in-out;
    z-index: ${p => p.theme.zIndex.settingsSidebarNav};
    box-shadow: ${p => p.theme.dropShadowHeavy};
  }
`;

const NavMask = styled('div')<{isVisible: boolean}>`
  display: none;
  @media (max-width: ${p => p.theme.breakpoints.md}) {
    display: ${p => (p.isVisible ? 'block' : 'none')};
    background: rgba(0, 0, 0, 0.35);
    height: 100%;
    width: 100%;
    position: absolute;
    z-index: ${p => p.theme.zIndex.settingsSidebarNavMask};
    animation: ${fadeIn} 250ms ease-in-out;
  }
`;

/**
 * Note: `overflow: hidden` will cause some buttons in `SettingsPageHeader` to be cut off because it has negative margin.
 * Will also cut off tooltips.
 */
const Content = styled('div')`
  flex: 1;
  min-width: 0; /* keep children from stretching container */
`;

const StyledSettingsHeader = styled(SettingsHeader)`
  border: none;
`;
