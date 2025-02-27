import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import Hook from 'sentry/components/hook';
import {NAV_GROUP_LABELS} from 'sentry/components/nav/constants';
import {useNavContext} from 'sentry/components/nav/context';
import {SeparatorItem, SidebarLink} from 'sentry/components/nav/primary/components';
import {PrimaryNavigationHelp} from 'sentry/components/nav/primary/help';
import {PrimaryNavigationOnboarding} from 'sentry/components/nav/primary/onboarding';
import {PrimaryNavigationServiceIncidents} from 'sentry/components/nav/primary/serviceIncidents';
import {PrimaryNavigationWhatsNew} from 'sentry/components/nav/primary/whatsNew';
import {NavLayout, PrimaryNavGroup} from 'sentry/components/nav/types';
import {
  IconDashboard,
  IconGraph,
  IconIssues,
  IconSearch,
  IconSettings,
} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';

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
        >
          <IconIssues />
        </SidebarLink>

        <SidebarLink
          to={`/${prefix}/explore/traces/`}
          analyticsKey="explore"
          label={NAV_GROUP_LABELS[PrimaryNavGroup.EXPLORE]}
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
            activeTo={`/${prefix}/dashboard`}
            analyticsKey="customizable-dashboards"
            label={NAV_GROUP_LABELS[PrimaryNavGroup.DASHBOARDS]}
          >
            <IconDashboard />
          </SidebarLink>
        </Feature>

        <Feature features={['performance-view']}>
          <SidebarLink
            to={`/${prefix}/insights/frontend/`}
            analyticsKey="insights-domains"
            label={NAV_GROUP_LABELS[PrimaryNavGroup.INSIGHTS]}
          >
            <IconGraph />
          </SidebarLink>
        </Feature>

        <SeparatorItem />

        <SidebarLink
          to={`/${prefix}/settings/${organization.slug}/`}
          activeTo={`/${prefix}/settings/`}
          analyticsKey="settings"
          label={NAV_GROUP_LABELS[PrimaryNavGroup.SETTINGS]}
        >
          <IconSettings />
        </SidebarLink>
      </SidebarBody>

      <SidebarFooter>
        <PrimaryNavigationHelp />

        <SeparatorItem />

        <PrimaryNavigationWhatsNew />
        <Hook
          name="sidebar:bottom-items"
          organization={organization}
          orientation="left"
        />
        <PrimaryNavigationServiceIncidents />
        <PrimaryNavigationOnboarding />
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

  ${p =>
    !p.isMobile &&
    css`
      align-items: center;
      gap: ${space(0.5)};
    `}

  ${p =>
    p.compact &&
    css`
      gap: ${space(0.5)};
    `}
`;

const SidebarFooterWrapper = styled('div')`
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  margin-top: auto;
`;
