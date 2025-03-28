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
import {NavTourElement, StackedNavigationTour} from 'sentry/components/nav/tour/tour';
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
    <SidebarFooterWrapper isMobile={layout === NavLayout.MOBILE}>
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
        <NavTourElement id={StackedNavigationTour.ISSUES} title={null} description={null}>
          <SidebarLink
            to={`/${prefix}/issues/`}
            analyticsKey="issues"
            label={NAV_GROUP_LABELS[PrimaryNavGroup.ISSUES]}
          >
            <IconIssues />
          </SidebarLink>
        </NavTourElement>

        <NavTourElement
          id={StackedNavigationTour.EXPLORE}
          title={null}
          description={null}
        >
          <SidebarLink
            to={
              organization.features.includes('performance-view')
                ? `/${prefix}/explore/traces/`
                : `/${prefix}/explore/profiling/`
            }
            activeTo={`/${prefix}/explore`}
            analyticsKey="explore"
            label={NAV_GROUP_LABELS[PrimaryNavGroup.EXPLORE]}
          >
            <IconSearch />
          </SidebarLink>
        </NavTourElement>

        <Feature
          features={['discover', 'discover-query', 'dashboards-basic', 'dashboards-edit']}
          hookName="feature-disabled:dashboards-sidebar-item"
          requireAll={false}
        >
          <NavTourElement
            id={StackedNavigationTour.DASHBOARDS}
            title={null}
            description={null}
          >
            <SidebarLink
              to={`/${prefix}/dashboards/`}
              activeTo={`/${prefix}/dashboard`}
              analyticsKey="dashboards"
              label={NAV_GROUP_LABELS[PrimaryNavGroup.DASHBOARDS]}
            >
              <IconDashboard />
            </SidebarLink>
          </NavTourElement>
        </Feature>

        <Feature features={['performance-view']}>
          <NavTourElement
            id={StackedNavigationTour.INSIGHTS}
            title={null}
            description={null}
          >
            <SidebarLink
              to={`/${prefix}/insights/frontend/`}
              activeTo={`/${prefix}/insights`}
              analyticsKey="insights"
              label={NAV_GROUP_LABELS[PrimaryNavGroup.INSIGHTS]}
            >
              <IconGraph type="area" />
            </SidebarLink>
          </NavTourElement>
        </Feature>

        <SeparatorItem />

        <NavTourElement
          id={StackedNavigationTour.SETTINGS}
          title={null}
          description={null}
        >
          <SidebarLink
            to={`/${prefix}/settings/${organization.slug}/`}
            activeTo={`/${prefix}/settings/`}
            analyticsKey="settings"
            label={NAV_GROUP_LABELS[PrimaryNavGroup.SETTINGS]}
          >
            <IconSettings />
          </SidebarLink>
        </NavTourElement>
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

const SidebarFooterWrapper = styled('div')<{isMobile: boolean}>`
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  margin-top: auto;
  margin-bottom: ${p => (p.isMobile ? space(1) : 0)};
`;
