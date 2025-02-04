import {Fragment, type MouseEventHandler, useCallback} from 'react';
import styled from '@emotion/styled';

import {openHelpSearchModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import {linkStyles} from 'sentry/components/links/styles';
import {
  isLinkActive,
  makeLinkPropsFromTo,
  type NavSidebarItem,
} from 'sentry/components/nav/utils';
import {
  IconDashboard,
  IconGraph,
  IconIssues,
  IconQuestion,
  IconSearch,
  IconSettings,
  IconStats,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

interface SidebarItemProps {
  item: NavSidebarItem;
  children?: React.ReactNode;
  onClick?: MouseEventHandler<HTMLElement>;
}

interface SidebarItemLinkProps {
  to: string;
  children?: React.ReactNode;
  onClick?: MouseEventHandler<HTMLElement>;
}

interface SidebarItemDropdownProps {
  items: MenuItemProps[];
  children?: React.ReactNode;
  onClick?: MouseEventHandler<HTMLElement>;
}

function SidebarBody({children}: {children: React.ReactNode}) {
  return <SidebarItemList>{children}</SidebarItemList>;
}

function SidebarFooter({children}: {children: React.ReactNode}) {
  return (
    <SidebarFooterWrapper>
      <SidebarItemList>{children}</SidebarItemList>
    </SidebarFooterWrapper>
  );
}

function SidebarItem({item}: SidebarItemProps) {
  const organization = useOrganization();

  const recordAnalytics = useCallback(
    () =>
      trackAnalytics('growth.clicked_sidebar', {item: item.analyticsKey, organization}),
    [organization, item.analyticsKey]
  );

  if (item.to) {
    return (
      <SidebarItemWrapper>
        <SidebarLink to={item.to} key={item.label} onClick={recordAnalytics}>
          {item.icon}
          <span>{item.label}</span>
        </SidebarLink>
      </SidebarItemWrapper>
    );
  }

  if (item.dropdown) {
    return (
      <SidebarItemWrapper>
        <SidebarMenu items={item.dropdown} key={item.label} onClick={recordAnalytics}>
          {item.icon}
          <span>{item.label}</span>
        </SidebarMenu>
      </SidebarItemWrapper>
    );
  }

  return null;
}

function SidebarMenu({items, children, onClick}: SidebarItemDropdownProps) {
  return (
    <DropdownMenu
      position="right-end"
      trigger={(props, isOpen) => {
        return (
          <NavButton
            {...props}
            onClick={event => {
              onClick?.(event);
              props.onClick?.(event);
            }}
          >
            <InteractionStateLayer hasSelectedBackground={isOpen} />
            {children}
          </NavButton>
        );
      }}
      items={items}
    />
  );
}

function SidebarLink({children, to, onClick}: SidebarItemLinkProps) {
  const location = useLocation();
  const isActive = isLinkActive(to, location.pathname);
  const linkProps = makeLinkPropsFromTo(to);

  return (
    <NavLink
      {...linkProps}
      onClick={onClick}
      aria-selected={isActive}
      aria-current={isActive ? 'page' : undefined}
    >
      <InteractionStateLayer hasSelectedBackground={isActive} />
      {children}
    </NavLink>
  );
}

export function PrimaryNavigationItems() {
  const organization = useOrganization();
  const prefix = `organizations/${organization.slug}`;

  return (
    <Fragment>
      <SidebarBody>
        <SidebarItem
          item={{
            label: t('Issues'),
            icon: <IconIssues />,
            analyticsKey: 'issues',
            to: `/${prefix}/issues/`,
          }}
        />
        <SidebarItem
          item={{
            label: t('Explore'),
            icon: <IconSearch />,
            analyticsKey: 'explore',
            to: `/${prefix}/explore/traces/`,
          }}
        />
        <Feature
          features={['discover', 'discover-query', 'dashboards-basic', 'dashboards-edit']}
          hookName="feature-disabled:dashboards-sidebar-item"
          requireAll={false}
        >
          <SidebarItem
            item={{
              label: t('Boards'),
              icon: <IconDashboard />,
              analyticsKey: 'customizable-dashboards',
              to: `/${prefix}/dashboards/`,
            }}
          />
        </Feature>
        <Feature features={['performance-view']}>
          <SidebarItem
            item={{
              label: t('Insights'),
              icon: <IconGraph />,
              analyticsKey: 'insights-domains',
              to: `/${prefix}/insights/frontend/`,
            }}
          />
        </Feature>
      </SidebarBody>
      <SidebarFooter>
        <SidebarItem
          item={{
            label: t('Help'),
            icon: <IconQuestion />,
            analyticsKey: 'help',
            dropdown: [
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
            ],
          }}
        />
        <SidebarItem
          item={{
            label: t('Stats'),
            icon: <IconStats />,
            analyticsKey: 'stats',
            to: `/${prefix}/stats/`,
          }}
        />
        <SidebarItem
          item={{
            label: t('Settings'),
            icon: <IconSettings />,
            analyticsKey: 'settings',
            to: `${prefix}/settings/${organization.slug}/`,
          }}
        />
      </SidebarFooter>
    </Fragment>
  );
}

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
  > a,
  button {
    display: flex;
    flex-direction: row;
    height: 40px;
    gap: ${space(1.5)};
    align-items: center;
    padding: auto ${space(1.5)};
    color: var(--color, currentColor);
    font-size: ${p => p.theme.fontSizeMedium};
    font-weight: ${p => p.theme.fontWeightNormal};
    line-height: 177.75%;

    & > * {
      pointer-events: none;
    }

    @media (min-width: ${p => p.theme.breakpoints.medium}) {
      flex-direction: column;
      justify-content: center;
      height: 52px;
      padding: ${space(0.5)} ${space(0.75)};
      border-radius: ${p => p.theme.borderRadius};
      font-size: ${p => p.theme.fontSizeExtraSmall};
      margin-inline: ${space(1)};
      gap: ${space(0.5)};
    }
  }
`;

const SidebarFooterWrapper = styled('div')`
  position: relative;
  border-top: 1px solid ${p => p.theme.translucentGray200};
  display: flex;
  flex-direction: row;
  align-items: stretch;
  padding-bottom: ${space(0.5)};
  margin-top: auto;
`;

const NavLink = styled(Link)`
  position: relative;
`;

const NavButton = styled('button')`
  border: none;
  position: relative;
  background: transparent;
  min-width: 58px;

  ${linkStyles}
`;
