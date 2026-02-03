import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Container} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Hook from 'sentry/components/hook';
import {
  IconCompass,
  IconDashboard,
  IconGraph,
  IconIssues,
  IconPrevent,
  IconSettings,
  IconSiren,
} from 'sentry/icons';
import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';
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
import {useActivateNavGroupOnHover} from 'sentry/views/nav/primary/useActivateNavGroupOnHover';
import {PrimaryNavigationWhatsNew} from 'sentry/views/nav/primary/whatsNew/whatsNew';
import {NavTourElement, StackedNavigationTour} from 'sentry/views/nav/tour/tour';
import {NavLayout, PrimaryNavGroup} from 'sentry/views/nav/types';
import {UserDropdown} from 'sentry/views/nav/userDropdown';

function SidebarBody({
  children,
  ref,
}: {
  children: React.ReactNode;
  ref: React.RefObject<HTMLUListElement | null>;
}) {
  const {layout} = useNavContext();
  return (
    <SidebarList
      isMobile={layout === NavLayout.MOBILE}
      data-primary-list-container
      ref={ref}
    >
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

function showPreventNav(organization: Organization) {
  // only people with test analytics can see the prevent nav
  // Legacy Seer and New Seer orgs are getting a Seer Config Reminder icon, which
  // means that the only Prevent sub-nav item remaining is the Tests item.
  return organization.features.includes('prevent-test-analytics');
}

export function PrimaryNavigationItems() {
  const organization = useOrganization();
  const prefix = `organizations/${organization.slug}`;
  const ref = useRef<HTMLUListElement>(null);

  const makeNavItemProps = useActivateNavGroupOnHover({ref});

  return (
    <Fragment>
      <SidebarBody ref={ref}>
        <NavTourElement id={StackedNavigationTour.ISSUES} title={null} description={null}>
          <SidebarLink
            to={`/${prefix}/issues/`}
            analyticsKey="issues"
            group={PrimaryNavGroup.ISSUES}
            {...makeNavItemProps(PrimaryNavGroup.ISSUES)}
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
            {...makeNavItemProps(PrimaryNavGroup.EXPLORE)}
          >
            <IconCompass />
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
              {...makeNavItemProps(PrimaryNavGroup.DASHBOARDS)}
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
              to={`/${prefix}/insights/`}
              activeTo={`/${prefix}/insights`}
              analyticsKey="insights"
              group={PrimaryNavGroup.INSIGHTS}
              {...makeNavItemProps(PrimaryNavGroup.INSIGHTS)}
            >
              <IconGraph type="area" />
            </SidebarLink>
          </NavTourElement>
        </Feature>

        <Feature features={['prevent-ai']}>
          {showPreventNav(organization) ? (
            <Container position="relative" height="100%">
              <SidebarLink
                to={`/${prefix}/prevent/tests/`}
                activeTo={`/${prefix}/prevent/`}
                analyticsKey="prevent"
                group={PrimaryNavGroup.PREVENT}
                {...makeNavItemProps(PrimaryNavGroup.PREVENT)}
              >
                <IconPrevent />
              </SidebarLink>
              <BetaBadge type="beta" />
            </Container>
          ) : null}
        </Feature>

        <SeparatorItem />

        <Feature features={['workflow-engine-ui']}>
          <Container position="relative" height="100%">
            <SidebarLink
              to={`/${prefix}/monitors/`}
              analyticsKey="monitors"
              group={PrimaryNavGroup.MONITORS}
              {...makeNavItemProps(PrimaryNavGroup.MONITORS)}
            >
              <IconSiren />
            </SidebarLink>
            <BetaBadge type="alpha" />
          </Container>
        </Feature>

        <NavTourElement
          id={StackedNavigationTour.SETTINGS}
          title={null}
          description={null}
        >
          <SidebarLink
            to={`/settings/${organization.slug}/`}
            activeTo="/settings/"
            analyticsKey="settings"
            group={PrimaryNavGroup.SETTINGS}
            {...makeNavItemProps(PrimaryNavGroup.SETTINGS)}
          >
            <IconSettings />
          </SidebarLink>
        </NavTourElement>
      </SidebarBody>

      <SidebarFooter>
        <ErrorBoundary customComponent={null}>
          <Hook name="sidebar:seer-config-reminder" organization={organization} />
        </ErrorBoundary>
        <PrimaryNavigationHelp />
        <ErrorBoundary customComponent={null}>
          <PrimaryNavigationWhatsNew />
        </ErrorBoundary>
        <ErrorBoundary customComponent={null}>
          <Hook name="sidebar:try-business" organization={organization} />
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

const BetaBadge = styled(FeatureBadge)`
  position: absolute;
  pointer-events: none;
  top: -2px;
  right: 2px;
  font-size: ${p => p.theme.font.size.xs};
  padding: 0 ${p => p.theme.space.xs};
  height: 16px;
`;
