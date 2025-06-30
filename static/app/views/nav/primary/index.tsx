import {Fragment} from 'react';

import Feature from 'sentry/components/acl/feature';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Hook from 'sentry/components/hook';
import {
  IconDashboard,
  IconGraph,
  IconIssues,
  IconPrevent,
  IconSearch,
  IconSettings,
} from 'sentry/icons';
import {ChonkOptInBanner} from 'sentry/utils/theme/ChonkOptInBanner';
import useOrganization from 'sentry/utils/useOrganization';
import {CODECOV_BASE_URL, COVERAGE_BASE_URL} from 'sentry/views/codecov/settings';
import {getDefaultExploreRoute} from 'sentry/views/explore/utils';
import {useNavContext} from 'sentry/views/nav/context';
import {
  SeparatorItem,
  SidebarFooterWrapper,
  SidebarLink,
  SidebarList,
} from 'sentry/views/nav/primary/components';
import {PrimaryNavigationHelp} from 'sentry/views/nav/primary/help';
import {PrimaryNavigationOnboarding} from 'sentry/views/nav/primary/onboarding';
import {PrimaryNavigationServiceIncidents} from 'sentry/views/nav/primary/serviceIncidents';
import {PrimaryNavigationWhatsNew} from 'sentry/views/nav/primary/whatsNew';
import {NavTourElement, StackedNavigationTour} from 'sentry/views/nav/tour/tour';
import {NavLayout, PrimaryNavGroup} from 'sentry/views/nav/types';
import {UserDropdown} from 'sentry/views/nav/userDropdown';

function SidebarBody({children}: {children: React.ReactNode}) {
  const {layout} = useNavContext();
  return (
    <SidebarList isMobile={layout === NavLayout.MOBILE} data-primary-list-container>
      {children}
    </SidebarList>
  );
}

function SidebarFooter({children}: {children: React.ReactNode}) {
  const {layout} = useNavContext();
  return (
    <SidebarFooterWrapper isMobile={layout === NavLayout.MOBILE}>
      <SidebarList
        isMobile={layout === NavLayout.MOBILE}
        compact={layout === NavLayout.SIDEBAR}
      >
        {children}
      </SidebarList>
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
            group={PrimaryNavGroup.ISSUES}
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
            to={`/${prefix}/explore/${getDefaultExploreRoute(organization)}/`}
            activeTo={`/${prefix}/explore`}
            analyticsKey="explore"
            group={PrimaryNavGroup.EXPLORE}
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
              group={PrimaryNavGroup.DASHBOARDS}
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
              group={PrimaryNavGroup.INSIGHTS}
            >
              <IconGraph type="area" />
            </SidebarLink>
          </NavTourElement>
        </Feature>

        <Feature features={['codecov-ui']}>
          <SidebarLink
            to={`/${prefix}/${CODECOV_BASE_URL}/${COVERAGE_BASE_URL}/commits/`}
            activeTo={`/${prefix}/${CODECOV_BASE_URL}/`}
            analyticsKey="codecov"
            group={PrimaryNavGroup.CODECOV}
          >
            <IconPrevent />
          </SidebarLink>
        </Feature>

        <SeparatorItem />

        <NavTourElement
          id={StackedNavigationTour.SETTINGS}
          title={null}
          description={null}
        >
          <SidebarLink
            to={`/settings/${organization.slug}/`}
            activeTo={`/settings/`}
            analyticsKey="settings"
            group={PrimaryNavGroup.SETTINGS}
          >
            <IconSettings />
          </SidebarLink>
        </NavTourElement>
      </SidebarBody>

      <SidebarFooter>
        <ChonkOptInBanner collapsed="never" />
        <PrimaryNavigationHelp />
        <ErrorBoundary customComponent={null}>
          <PrimaryNavigationWhatsNew />
        </ErrorBoundary>
        <ErrorBoundary customComponent={null}>
          <Hook
            name="sidebar:try-business"
            organization={organization}
            orientation="left"
          />
        </ErrorBoundary>
        <ErrorBoundary customComponent={null}>
          <Hook name="sidebar:billing-status" organization={organization} />
        </ErrorBoundary>
        <ErrorBoundary customComponent={null}>
          <PrimaryNavigationServiceIncidents />
        </ErrorBoundary>
        <ErrorBoundary customComponent={null}>
          <PrimaryNavigationOnboarding />
        </ErrorBoundary>
        <SeparatorItem hasMargin />
        <UserDropdown />
      </SidebarFooter>
    </Fragment>
  );
}
