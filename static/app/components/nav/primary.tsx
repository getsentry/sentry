import {Fragment, type MouseEventHandler, useCallback} from 'react';
import styled from '@emotion/styled';

import {openHelpSearchModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import {linkStyles} from 'sentry/components/links/styles';
import {
  isNavItemActive,
  isSubmenuItemActive,
  makeLinkPropsFromTo,
  type NavSidebarItem,
  resolveNavItemTo,
} from 'sentry/components/nav/utils';
import {
  IconDashboard,
  IconGraph,
  IconIssues,
  IconLightning,
  IconProject,
  IconQuestion,
  IconSearch,
  IconSettings,
  IconSiren,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getDiscoverLandingUrl} from 'sentry/utils/discover/urls';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {getSearchForIssueGroup, IssueGroup} from 'sentry/views/issueList/utils';

interface SidebarItemProps {
  item: NavSidebarItem;
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
  const to = resolveNavItemTo(item);
  const SidebarChild = to ? SidebarLink : SidebarMenu;
  const organization = useOrganization();

  const FeatureGuard = item.feature ? Feature : Fragment;
  const featureGuardProps: any = item.feature ?? {};

  const recordAnalytics = useCallback(
    () =>
      trackAnalytics('growth.clicked_sidebar', {item: item.analyticsKey, organization}),
    [organization, item.analyticsKey]
  );

  return (
    <FeatureGuard {...featureGuardProps}>
      <SidebarItemWrapper>
        <SidebarChild item={item} key={item.label} onClick={recordAnalytics}>
          {item.icon}
          <span>{item.label}</span>
        </SidebarChild>
      </SidebarItemWrapper>
    </FeatureGuard>
  );
}

function SidebarMenu({item, children, onClick}: SidebarItemProps) {
  if (!item.dropdown) {
    throw new Error(
      `Nav item "${item.label}" must have either a \`dropdown\` or \`to\` value!`
    );
  }
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
      items={item.dropdown}
    />
  );
}

function SidebarLink({children, item, onClick}: SidebarItemProps) {
  const location = useLocation();
  const isActive = isNavItemActive(item, location);
  const isSubmenuActive = isSubmenuItemActive(item, location);
  const to = resolveNavItemTo(item);
  if (!to) {
    throw new Error(
      `Nav item "${item.label}" must have either a \`dropdown\` or \`to\` value!`
    );
  }
  const linkProps = makeLinkPropsFromTo(to);

  return (
    <NavLink
      {...linkProps}
      onClick={onClick}
      className={isActive || isSubmenuActive ? 'active' : undefined}
      aria-current={isActive ? 'page' : undefined}
    >
      <InteractionStateLayer hasSelectedBackground={isActive || isSubmenuActive} />
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
            submenu: [
              {
                label: t('All'),
                to: `/${prefix}/issues/?query=is:unresolved`,
              },
              {
                label: t('Error & Outage'),
                to: `/${prefix}/issues/${getSearchForIssueGroup(IssueGroup.ERROR_OUTAGE)}`,
              },
              {
                label: t('Trend'),
                to: `/${prefix}/issues/${getSearchForIssueGroup(IssueGroup.TREND)}`,
              },
              {
                label: t('Craftsmanship'),
                to: `/${prefix}/issues/${getSearchForIssueGroup(IssueGroup.CRAFTSMANSHIP)}`,
              },
              {
                label: t('Security'),
                to: `/${prefix}/issues/${getSearchForIssueGroup(IssueGroup.SECURITY)}`,
              },
              {label: t('Feedback'), to: `/${prefix}/feedback/`},
            ],
          }}
        />
        <SidebarItem
          item={{
            label: t('Projects'),
            icon: <IconProject />,
            analyticsKey: 'projects',
            to: `/${prefix}/projects/`,
          }}
        />
        <SidebarItem
          item={{
            label: t('Explore'),
            icon: <IconSearch />,
            analyticsKey: 'explore',
            submenu: [
              {
                label: t('Traces'),
                to: `/${prefix}/traces/`,
                feature: {features: 'performance-trace-explorer'},
              },
              {
                label: t('Metrics'),
                to: `/${prefix}/metrics/`,
                feature: {features: 'custom-metrics'},
              },
              {
                label: t('Profiles'),
                to: `/${prefix}/profiling/`,
                feature: {
                  features: 'profiling',
                  hookName: 'feature-disabled:profiling-sidebar-item',
                  requireAll: false,
                },
              },
              {
                label: t('Replays'),
                to: `/${prefix}/replays/`,
                feature: {
                  features: 'session-replay-ui',
                  hookName: 'feature-disabled:replay-sidebar-item',
                },
              },
              {
                label: t('Discover'),
                to: getDiscoverLandingUrl(organization),
                feature: {
                  features: 'discover-basic',
                  hookName: 'feature-disabled:discover2-sidebar-item',
                },
              },
              {label: t('Releases'), to: `/${prefix}/releases/`},
              {label: t('Crons'), to: `/${prefix}/crons/`},
            ],
          }}
        />
        <Feature features={['performance-view']}>
          <SidebarItem
            item={{
              label: t('Insights'),
              icon: <IconGraph />,
              analyticsKey: 'insights-domains',
              submenu: [
                {
                  label: t('Frontend'),
                  to: `/${prefix}/domain-views/frontend/`,
                },
                {
                  label: t('Backend'),
                  to: `/${prefix}/domain-views/backend/`,
                },
                {
                  label: t('Mobile'),
                  to: `/${prefix}/domain-views/mobile/`,
                },
                {
                  label: t('AI'),
                  to: `/${prefix}/domain-views/ai/`,
                },
              ],
            }}
          />
        </Feature>
        <Feature
          features={['performance-view']}
          hookName="feature-disabled:performance-sidebar-item"
        >
          <SidebarItem
            item={{
              label: t('Perf.'),
              icon: <IconLightning />,
              analyticsKey: 'performance',
              to: `/${prefix}/performance/`,
            }}
          />
        </Feature>
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
        <SidebarItem
          item={{
            label: t('Alerts'),
            icon: <IconSiren />,
            analyticsKey: 'alerts',
            to: `/${prefix}/alerts/rules/`,
          }}
        />
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
            label: t('Settings'),
            icon: <IconSettings />,
            analyticsKey: 'settings',
            to: `/settings/${organization.slug}/`,
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
