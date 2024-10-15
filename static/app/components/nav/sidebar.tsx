import {Fragment, type PropsWithChildren, Suspense} from 'react';
import styled from '@emotion/styled';
import { AnimatePresence } from 'framer-motion'

import Feature from 'sentry/components/acl/feature';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import {useNavContext} from 'sentry/components/nav/context';
import Submenu from 'sentry/components/nav/submenu';
import {
  isNavItemActive,
  isNonEmptyArray,
  isSubmenuItemActive,
  makeLinkPropsFromTo,
  type NavSidebarItem,
  resolveNavItemTo,
} from 'sentry/components/nav/utils';
import {Overlay} from 'sentry/components/overlay';
import SidebarDropdown from 'sentry/components/sidebar/sidebarDropdown';
import {space} from 'sentry/styles/space';
import theme from 'sentry/utils/theme';
import {useLocation} from 'sentry/utils/useLocation';
import useOverlay from 'sentry/utils/useOverlay';

function Sidebar() {
  return (
    <Fragment>
      <SidebarWrapper role="navigation" aria-label="Primary Navigation">
        <SidebarHeader>
          <SidebarDropdown orientation="left" collapsed />
        </SidebarHeader>
        <SidebarItems />
      </SidebarWrapper>
      <Submenu />
    </Fragment>
  );
}

export default Sidebar;

export function SidebarItems() {
  const {config} = useNavContext();
  return (
    <Fragment>
      <SidebarBody>
        {config.main.map(item => (
          <SidebarItem key={item.label} item={item} />
        ))}
      </SidebarBody>
      {isNonEmptyArray(config.footer) && (
        <SidebarFooter>
          {config.footer.map(item => (
            <SidebarItem key={item.label} item={item} />
          ))}
        </SidebarFooter>
      )}
    </Fragment>
  );
}

const SidebarWrapper = styled('div')`
  height: 40px;
  width: 100vw;
  padding: ${space(2)} 0;
  border-right: 1px solid ${theme.translucentGray100};
  /* these colors should be moved to the "theme" object */
  background: #3e2648;
  background: linear-gradient(180deg, #3e2648 0%, #442c4e 100%);
  display: flex;
  flex-direction: column;
  z-index: ${theme.zIndex.sidebar};

  @media screen and (min-width: ${p => p.theme.breakpoints.medium}) {
    height: unset;
    width: 74px;
  }
`;

const SidebarItemList = styled('ul')`
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0;
  padding-top: ${space(1)};
  display: flex;
  flex-direction: column;
  width: 100%;
  color: rgba(255, 255, 255, 0.85);

  @media screen and (min-width: ${p => p.theme.breakpoints.medium}) {
    gap: ${space(1)};
  }
`;

interface SidebarItemProps {
  item: NavSidebarItem;
}

function SidebarItem({item}: SidebarItemProps) {
  const to = resolveNavItemTo(item);
  const Component = to ? SidebarLink : SidebarOverlay;

  const FeatureGuard = item.feature ? Feature : Fragment;
  const featureGuardProps: any = item.feature ?? {};

  return (
    <FeatureGuard {...featureGuardProps}>
      <SidebarItemWrapper>
        <Component item={item}>
          {item.icon}
          <span>{item.label}</span>
        </Component>
      </SidebarItemWrapper>
    </FeatureGuard>
  );
}

const StyledLink = styled(Link)`
  position: relative;
`;

function SidebarLink({children, item}: PropsWithChildren<SidebarItemProps>) {
  const location = useLocation();
  const isActive = isNavItemActive(item, location);
  const isSubmenuActive = isSubmenuItemActive(item, location);
  const to = resolveNavItemTo(item);
  const linkProps = makeLinkPropsFromTo(to!);

  return (
    <StyledLink
      {...linkProps}
      className={isActive || isSubmenuActive ? 'active' : undefined}
      aria-current={isActive ? 'page' : undefined}
    >
      <InteractionStateLayer hasSelectedBackground={isActive || isSubmenuActive} />
      {children}
    </StyledLink>
  );
}

function SidebarOverlay({children, item}: PropsWithChildren<SidebarItemProps>) {
  const {isOpen, triggerProps, overlayProps} = useOverlay({
    defaultOpen: false,
    position: 'auto-end',
  });

  if (!item.overlay) {
    return null;
  }

  return (
    <Fragment>
      <button {...triggerProps} className={isOpen ? 'active' : undefined}>
        {children}
      </button>
      <AnimatePresence>
        {isOpen && (
          <Overlay
            overlayStyle={{color: theme.black, fontSize: '1rem'}}
            {...(overlayProps as any)}
          >
            <Suspense fallback={null}>
              <item.overlay />
            </Suspense>
          </Overlay>
        )}
      </AnimatePresence>
    </Fragment>
  );
}

const SidebarItemWrapper = styled('li')`
  svg {
    --size: 14px;
    width: var(--size);
    height: var(--size);

    @media (min-width: ${p => p.theme.breakpoints.medium}) {
      --size: 18px;
      padding-top: ${space(0.5)};
    }
  }
  button {
    background: transparent;
    min-width: 58px;
  }
  a,
  button {
    display: flex;
    flex-direction: row;
    height: 32px;
    gap: ${space(1.5)};
    align-items: center;
    padding: 0 ${space(1.5)};
    color: var(--color, currentColor);
    font-size: ${theme.fontSizeMedium};
    font-weight: ${theme.fontWeightNormal};
    line-height: 177.75%;

    & > * {
      pointer-events: none;
    }

    @media (min-width: ${p => p.theme.breakpoints.medium}) {
      flex-direction: column;
      justify-content: center;
      height: 52px;
      padding: ${space(0.5)} ${space(0.75)};
      border-radius: ${theme.borderRadius};
      font-size: ${theme.fontSizeExtraSmall};
      margin-inline: ${space(1)};
      gap: ${space(0.5)};
    }
  }
`;

const SidebarFooterWrapper = styled('div')`
  position: relative;
  border-top: 1px solid ${theme.translucentGray200};
  display: flex;
  flex-direction: row;
  align-items: stretch;
  padding-bottom: ${space(0.5)};
  margin-top: auto;
`;

const SidebarHeader = styled('header')`
  position: relative;
  display: flex;
  justify-content: center;
  margin-bottom: ${space(1.5)};
`;

function SidebarBody({children}) {
  return <SidebarItemList>{children}</SidebarItemList>;
}

function SidebarFooter({children}) {
  return (
    <SidebarFooterWrapper>
      <SidebarItemList>{children}</SidebarItemList>
    </SidebarFooterWrapper>
  );
}
