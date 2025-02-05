import {Fragment, type MouseEventHandler, useCallback} from 'react';
import styled from '@emotion/styled';

import {openHelpSearchModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import {linkStyles} from 'sentry/components/links/styles';
import {useNavContext} from 'sentry/components/nav/context';
import {NavLayout} from 'sentry/components/nav/types';
import {isLinkActive, makeLinkPropsFromTo} from 'sentry/components/nav/utils';
import {
  IconChevron,
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
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

interface SidebarItemLinkProps {
  analyticsKey: string;
  to: string;
  activeTo?: string;
  children?: React.ReactNode;
  onClick?: MouseEventHandler<HTMLElement>;
}

interface SidebarItemDropdownProps {
  analyticsKey: string;
  items: MenuItemProps[];
  children?: React.ReactNode;
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

function SidebarMenu({items, children, analyticsKey}: SidebarItemDropdownProps) {
  const organization = useOrganization();
  const recordAnalytics = useCallback(
    () => trackAnalytics('growth.clicked_sidebar', {item: analyticsKey, organization}),
    [organization, analyticsKey]
  );

  return (
    <SidebarItemWrapper>
      <DropdownMenu
        position="right-end"
        trigger={(props, isOpen) => {
          return (
            <NavButton
              {...props}
              onClick={event => {
                recordAnalytics();
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
    </SidebarItemWrapper>
  );
}

function SidebarLink({children, to, activeTo = to, analyticsKey}: SidebarItemLinkProps) {
  const organization = useOrganization();
  const location = useLocation();
  const isActive = isLinkActive(normalizeUrl(activeTo, location), location.pathname);
  const linkProps = makeLinkPropsFromTo(to);

  const recordAnalytics = useCallback(
    () => trackAnalytics('growth.clicked_sidebar', {item: analyticsKey, organization}),
    [organization, analyticsKey]
  );

  return (
    <SidebarItemWrapper>
      <NavLink
        {...linkProps}
        onClick={recordAnalytics}
        aria-selected={isActive}
        aria-current={isActive ? 'page' : undefined}
      >
        <InteractionStateLayer hasSelectedBackground={isActive} />
        {children}
      </NavLink>
    </SidebarItemWrapper>
  );
}

function CollapseButton() {
  const {isCollapsed, setIsCollapsed, layout} = useNavContext();

  if (layout !== NavLayout.SIDEBAR) {
    return null;
  }

  return (
    <SidebarItemWrapper>
      <NavButton onClick={() => setIsCollapsed(!isCollapsed)}>
        <InteractionStateLayer />
        <IconChevron direction={isCollapsed ? 'right' : 'left'} isDouble />
        {isCollapsed ? t('Expand') : t('Collapse')}
      </NavButton>
    </SidebarItemWrapper>
  );
}

export function PrimaryNavigationItems() {
  const organization = useOrganization();
  const prefix = `organizations/${organization.slug}`;

  return (
    <Fragment>
      <SidebarBody>
        <SidebarLink to={`/${prefix}/issues/`} analyticsKey="issues">
          <IconIssues />
          <span>{t('Issues')}</span>
        </SidebarLink>

        <SidebarLink to={`/${prefix}/explore/traces/`} analyticsKey="explore">
          <IconSearch />
          <span>{t('Explore')}</span>
        </SidebarLink>

        <Feature
          features={['discover', 'discover-query', 'dashboards-basic', 'dashboards-edit']}
          hookName="feature-disabled:dashboards-sidebar-item"
          requireAll={false}
        >
          <SidebarLink
            to={`/${prefix}/dashboards/`}
            analyticsKey="customizable-dashboards"
          >
            <IconDashboard />
            <span>{t('Boards')}</span>
          </SidebarLink>
        </Feature>

        <Feature features={['performance-view']}>
          <SidebarLink
            to={`/${prefix}/insights/frontend/`}
            analyticsKey="insights-domains"
          >
            <IconGraph />
            <span>{t('Insights')}</span>
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
        >
          <IconQuestion />
          <span>{t('Help')}</span>
        </SidebarMenu>

        <SidebarLink to={`/${prefix}/stats/`} analyticsKey="stats">
          <IconStats />
          <span>{t('Stats')}</span>
        </SidebarLink>

        <SidebarLink
          to={`/${prefix}/settings/`}
          activeTo={`/${prefix}/settings/`}
          analyticsKey="settings"
        >
          <IconSettings />
          <span>{t('Settings')}</span>
        </SidebarLink>

        <CollapseButton />
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
      --size: 16px;
    }
  }
  > a,
  button {
    display: flex;
    flex-direction: row;
    height: 40px;
    gap: ${space(1.5)};
    align-items: center;
    padding: 0 ${space(1.5)};
    color: var(--color, currentColor);
    font-size: ${p => p.theme.fontSizeMedium};
    font-weight: ${p => p.theme.fontWeightNormal};
    line-height: 1;

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
      gap: ${space(0.75)};
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
