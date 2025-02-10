import {isValidElement, useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import * as Layout from 'sentry/components/layouts/thirds';
import {IconClose, IconMenu} from 'sentry/icons';
import {t} from 'sentry/locale';
import {fadeIn, slideInLeft} from 'sentry/styles/animations';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {useLocation} from 'sentry/utils/useLocation';

import SettingsBreadcrumb from './settingsBreadcrumb';
import SettingsHeader from './settingsHeader';
import SettingsSearch from './settingsSearch';

type Props = {
  children: React.ReactNode;
  renderNavigation?: (opts: {isMobileNavVisible: boolean}) => React.ReactNode;
} & RouteComponentProps<{}, {}>;

function SettingsLayout(props: Props) {
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

  const {renderNavigation, children, params, routes, route} = props;

  // We want child's view's props
  const childProps = children && isValidElement(children) ? children.props : props;
  const childRoutes = childProps.routes || routes || [];
  const childRoute = childProps.route || route || {};
  const shouldRenderNavigation = typeof renderNavigation === 'function';

  return (
    <SettingsColumn>
      <SettingsHeader ref={headerRef}>
        <HeaderContent>
          {shouldRenderNavigation && (
            <NavMenuToggle
              priority="link"
              aria-label={isMobileNavVisible ? t('Close the menu') : t('Open the menu')}
              icon={
                isMobileNavVisible ? <IconClose aria-hidden /> : <IconMenu aria-hidden />
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
        </HeaderContent>
      </SettingsHeader>

      <MaxWidthContainer>
        {shouldRenderNavigation && (
          <SidebarWrapper
            aria-label={t('Settings Navigation')}
            isVisible={isMobileNavVisible}
            offsetTop={navOffsetTop}
          >
            {renderNavigation({isMobileNavVisible})}
          </SidebarWrapper>
        )}
        <NavMask isVisible={isMobileNavVisible} onClick={() => toggleNav(false)} />
        <Content>{children}</Content>
      </MaxWidthContainer>
    </SettingsColumn>
  );
}

const SettingsColumn = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1; /* so this stretches vertically so that footer is fixed at bottom */
  min-width: 0; /* fixes problem when child content stretches beyond layout width */
  footer {
    margin-top: 0;
  }
`;

const HeaderContent = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const NavMenuToggle = styled(Button)`
  display: none;
  margin: -${space(1)} ${space(1)} -${space(1)} -${space(1)};
  padding: ${space(1)};
  color: ${p => p.theme.subText};
  &:hover,
  &:focus,
  &:active {
    color: ${p => p.theme.textColor};
  }
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    display: block;
  }
`;

const StyledSettingsBreadcrumb = styled(SettingsBreadcrumb)`
  flex: 1;
`;

const MaxWidthContainer = styled('div')`
  display: flex;
  /* @TODO(jonasbadalic) 1440px used to be defined as theme.settings.containerWidth and only used here */
  max-width: 1440px;
  flex: 1;
`;

const SidebarWrapper = styled('nav')<{isVisible: boolean; offsetTop: number}>`
  flex-shrink: 0;
  /* @TODO(jonasbadalic) 220px used to be defined as theme.settings.sidebarWidth and only used here */
  width: 220px;
  background: ${p => p.theme.background};
  border-right: 1px solid ${p => p.theme.border};

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
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
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
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
  padding: ${space(4)};
  min-width: 0; /* keep children from stretching container */

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(2)};
  }

  /**
   * Layout.Page is not normally used in settings but <PermissionDenied /> uses
   * it under the hood. This prevents double padding.
   */
  ${Layout.Page} {
    padding: 0;
  }

  /**
   * Components which use Layout.Header will provide their own padding.
   * TODO: Refactor existing components to use Layout.Header and Layout.Body,
   * then remove the padding from this component.
   */
  &:has(${Layout.Header}) {
    padding: 0;
  }
`;

export default SettingsLayout;
