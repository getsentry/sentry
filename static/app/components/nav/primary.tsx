import {Fragment, type MouseEventHandler, useCallback} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {openHelpSearchModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import {linkStyles} from 'sentry/components/links/styles';
import {NAV_GROUP_LABELS, PRIMARY_SIDEBAR_WIDTH} from 'sentry/components/nav/constants';
import {useNavContext} from 'sentry/components/nav/context';
import {NavLayout, PrimaryNavGroup} from 'sentry/components/nav/types';
import {isLinkActive, makeLinkPropsFromTo} from 'sentry/components/nav/utils';
import {
  IconChevron,
  IconDashboard,
  IconGraph,
  IconIssues,
  IconQuestion,
  IconSearch,
  IconSettings,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

interface SidebarItemLinkProps {
  analyticsKey: string;
  label: string;
  to: string;
  activeTo?: string;
  children?: React.ReactNode;
  forceLabel?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
}

interface SidebarItemDropdownProps {
  analyticsKey: string;
  items: MenuItemProps[];
  label: string;
  children?: React.ReactNode;
  forceLabel?: boolean;
}

function SidebarBody({children}: {children: React.ReactNode}) {
  const {layout} = useNavContext();
  return (
    <SidebarItemList isMobile={layout === NavLayout.MOBILE}>{children}</SidebarItemList>
  );
}

function SidebarFooter({children}: {children: React.ReactNode}) {
  const {layout} = useNavContext();
  return (
    <SidebarFooterWrapper>
      <SidebarItemList
        isMobile={layout === NavLayout.MOBILE}
        compact={layout === NavLayout.SIDEBAR}
      >
        {children}
      </SidebarItemList>
    </SidebarFooterWrapper>
  );
}

function SidebarItem({children}: {children: React.ReactNode}) {
  const {layout} = useNavContext();
  return (
    <SidebarItemWrapper isMobile={layout === NavLayout.MOBILE}>
      {children}
    </SidebarItemWrapper>
  );
}

function SidebarMenu({
  items,
  children,
  analyticsKey,
  label,
  forceLabel,
}: SidebarItemDropdownProps) {
  const organization = useOrganization();
  const recordAnalytics = useCallback(
    () => trackAnalytics('growth.clicked_sidebar', {item: analyticsKey, organization}),
    [organization, analyticsKey]
  );
  const {layout} = useNavContext();

  const showLabel = forceLabel || layout === NavLayout.MOBILE;

  return (
    <SidebarItem>
      <DropdownMenu
        position="right-end"
        trigger={(props, isOpen) => {
          return (
            <NavButton
              {...props}
              aria-label={!showLabel ? label : undefined}
              onClick={event => {
                recordAnalytics();
                props.onClick?.(event);
              }}
            >
              <InteractionStateLayer hasSelectedBackground={isOpen} />
              {children}
              {showLabel ? label : null}
            </NavButton>
          );
        }}
        items={items}
      />
    </SidebarItem>
  );
}

function SidebarLink({
  children,
  to,
  activeTo = to,
  analyticsKey,
  label,
  forceLabel = false,
}: SidebarItemLinkProps) {
  const organization = useOrganization();
  const location = useLocation();
  const isActive = isLinkActive(normalizeUrl(activeTo, location), location.pathname);
  const linkProps = makeLinkPropsFromTo(to);

  const {layout} = useNavContext();
  const showLabel = forceLabel || layout === NavLayout.MOBILE;

  const recordAnalytics = useCallback(
    () => trackAnalytics('growth.clicked_sidebar', {item: analyticsKey, organization}),
    [organization, analyticsKey]
  );

  return (
    <SidebarItem>
      <NavLink
        {...linkProps}
        onClick={recordAnalytics}
        aria-selected={isActive}
        aria-current={isActive ? 'page' : undefined}
        aria-label={!showLabel ? label : undefined}
      >
        <InteractionStateLayer hasSelectedBackground={isActive} />
        {children}
        {showLabel ? label : null}
      </NavLink>
    </SidebarItem>
  );
}

function CollapseButton() {
  const {isCollapsed, setIsCollapsed, layout} = useNavContext();

  if (layout !== NavLayout.SIDEBAR) {
    return null;
  }

  return (
    <SidebarItem>
      <NavButton
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-label={isCollapsed ? t('Expand') : t('Collapse')}
      >
        <InteractionStateLayer />
        <IconChevron direction={isCollapsed ? 'right' : 'left'} isDouble />
      </NavButton>
    </SidebarItem>
  );
}

export function PrimaryNavigationItems() {
  const organization = useOrganization();
  const prefix = `organizations/${organization.slug}`;

  return (
    <Fragment>
      <SidebarBody>
        <SidebarLink
          to={`/${prefix}/issues/`}
          analyticsKey="issues"
          label={NAV_GROUP_LABELS[PrimaryNavGroup.ISSUES]}
          forceLabel
        >
          <IconIssues />
        </SidebarLink>

        <SidebarLink
          to={`/${prefix}/explore/traces/`}
          analyticsKey="explore"
          label={NAV_GROUP_LABELS[PrimaryNavGroup.EXPLORE]}
          forceLabel
        >
          <IconSearch />
        </SidebarLink>

        <Feature
          features={['discover', 'discover-query', 'dashboards-basic', 'dashboards-edit']}
          hookName="feature-disabled:dashboards-sidebar-item"
          requireAll={false}
        >
          <SidebarLink
            to={`/${prefix}/dashboards/`}
            analyticsKey="customizable-dashboards"
            label={NAV_GROUP_LABELS[PrimaryNavGroup.DASHBOARDS]}
            forceLabel
          >
            <IconDashboard />
          </SidebarLink>
        </Feature>

        <Feature features={['performance-view']}>
          <SidebarLink
            to={`/${prefix}/insights/frontend/`}
            analyticsKey="insights-domains"
            label={NAV_GROUP_LABELS[PrimaryNavGroup.INSIGHTS]}
            forceLabel
          >
            <IconGraph />
          </SidebarLink>
        </Feature>
      </SidebarBody>

      <SidebarFooter>
        <SidebarMenu
          items={[
            {
              key: 'search',
              label: t('Search Support, Docs and More'),
              onAction() {
                openHelpSearchModal({organization});
              },
            },
            {
              key: 'help',
              label: t('Visit Help Center'),
              to: 'https://sentry.zendesk.com/hc/en-us',
            },
            {
              key: 'discord',
              label: t('Join our Discord'),
              to: 'https://discord.com/invite/sentry',
            },
            {
              key: 'support',
              label: t('Contact Support'),
              to: `mailto:${ConfigStore.get('supportEmail')}`,
            },
          ]}
          analyticsKey="help"
          label={t('Help')}
        >
          <IconQuestion />
        </SidebarMenu>

        <SidebarLink
          to={`/${prefix}/settings/${organization.slug}/`}
          activeTo={`/${prefix}/settings/`}
          analyticsKey="settings"
          label={NAV_GROUP_LABELS[PrimaryNavGroup.SETTINGS]}
        >
          <IconSettings />
        </SidebarLink>

        <CollapseButton />
      </SidebarFooter>
    </Fragment>
  );
}

const SidebarItemList = styled('ul')<{isMobile: boolean; compact?: boolean}>`
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0;
  padding-top: ${space(1)};
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: ${space(0.5)};
  width: 100%;
  color: rgba(255, 255, 255, 0.85);

  ${p =>
    !p.isMobile &&
    css`
      align-items: center;
      gap: ${space(1)};
    `}

  ${p =>
    p.compact &&
    css`
      gap: ${space(0.5)};
    `}
`;

const SidebarItemWrapper = styled('li')<{isMobile: boolean}>`
  svg {
    --size: 14px;
    width: var(--size);
    height: var(--size);

    ${p =>
      !p.isMobile &&
      css`
        --size: 16px;
      `}
  }
  > a,
  button {
    display: flex;
    flex-direction: row;
    gap: ${space(1.5)};
    align-items: center;
    padding: ${space(1.5)} ${space(3)};
    color: var(--color, currentColor);
    font-size: ${p => p.theme.fontSizeMedium};
    font-weight: ${p => p.theme.fontWeightNormal};
    line-height: 1;
    width: 100%;

    & > * {
      pointer-events: none;
    }

    ${p =>
      !p.isMobile &&
      css`
        flex-direction: column;
        justify-content: center;
        border-radius: ${p.theme.borderRadius};
        margin-inline: 0 auto;
        gap: ${space(0.75)};
        padding: ${space(1.5)} 0;
        min-height: 44px;
        width: ${PRIMARY_SIDEBAR_WIDTH - 10}px;
        letter-spacing: -0.02em;
        font-size: 10px;
      `}
  }
`;

const SidebarFooterWrapper = styled('div')`
  position: relative;
  border-top: 1px solid ${p => p.theme.translucentGray200};
  display: flex;
  flex-direction: row;
  align-items: stretch;
  margin-top: auto;
`;

const NavLink = styled(Link)`
  position: relative;
`;

const NavButton = styled('button')`
  border: none;
  position: relative;
  background: transparent;

  ${linkStyles}
`;
