import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';
import {mergeProps} from '@react-aria/utils';

import {FeatureBadge} from '@sentry/scraps/badge';
import {ButtonBar} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

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
import useOrganization from 'sentry/utils/useOrganization';
import {getDefaultExploreRoute} from 'sentry/views/explore/utils';
import {useNavigationContext} from 'sentry/views/navigation/context';
import {
  NavigationTour,
  NavigationTourElement,
} from 'sentry/views/navigation/navigationTour';
import {
  SeparatorItem,
  SidebarLink,
  SidebarList,
} from 'sentry/views/navigation/primary/components';
import {PrimaryNavigationHelp} from 'sentry/views/navigation/primary/help';
import {PrimaryNavigationOnboarding} from 'sentry/views/navigation/primary/onboarding';
import {PrimaryNavigationServiceIncidents} from 'sentry/views/navigation/primary/serviceIncidents';
import {useActivateNavigationGroupOnHover} from 'sentry/views/navigation/primary/useActivateNavigationGroupOnHover';
import {UserDropdown} from 'sentry/views/navigation/primary/userDropdown';
import {PrimaryNavigationWhatsNew} from 'sentry/views/navigation/primary/whatsNew/whatsNew';
import {NavigationLayout, PrimaryNavigationGroup} from 'sentry/views/navigation/types';

function SidebarBody({
  children,
  ref,
}: {
  children: React.ReactNode;
  ref: React.RefObject<HTMLUListElement | null>;
}) {
  const {layout} = useNavigationContext();
  return (
    <SidebarList
      isMobile={layout === NavigationLayout.MOBILE}
      data-primary-list-container
      ref={ref}
    >
      {children}
    </SidebarList>
  );
}

function SidebarFooter({children}: {children: React.ReactNode}) {
  const {layout} = useNavigationContext();
  const isMobile = layout === NavigationLayout.MOBILE;

  if (!children) {
    return null;
  }

  return (
    <Flex
      display="flex"
      // @TODO(Jonas): add a <Flex grow={1]> between the primary and secondary nav
      align="center"
      justify={isMobile ? 'start' : 'center'}
      width={isMobile ? '100%' : 'auto'}
    >
      {isMobile ? (
        <Stack width="100%">{children}</Stack>
      ) : (
        <FooterButtonBar orientation="vertical">{children}</FooterButtonBar>
      )}
    </Flex>
  );
}

function showPreventNavigation() {
  // only people with test analytics can see the prevent nav
  // Legacy Seer and New Seer orgs are getting a Seer Config Reminder icon, which
  // means that the only Prevent sub-nav item remaining is the Tests item.
  return false;
}

export function PrimaryNavigationItems() {
  const organization = useOrganization();
  const prefix = `organizations/${organization.slug}`;
  const ref = useRef<HTMLUListElement>(null);

  const makeNavigationItemProps = useActivateNavigationGroupOnHover({ref});

  return (
    <Fragment>
      <SidebarBody ref={ref}>
        <NavigationTourElement id={NavigationTour.ISSUES} title={null} description={null}>
          {tourProps => (
            <SidebarLink
              to={`/${prefix}/issues/`}
              analyticsKey="issues"
              group={PrimaryNavigationGroup.ISSUES}
              {...mergeProps(
                makeNavigationItemProps(PrimaryNavigationGroup.ISSUES),
                tourProps
              )}
            >
              <IconIssues />
            </SidebarLink>
          )}
        </NavigationTourElement>

        <NavigationTourElement
          id={NavigationTour.EXPLORE}
          title={null}
          description={null}
        >
          {tourProps => (
            <SidebarLink
              to={`/${prefix}/explore/${getDefaultExploreRoute(organization)}/`}
              activeTo={`/${prefix}/explore`}
              analyticsKey="explore"
              group={PrimaryNavigationGroup.EXPLORE}
              {...mergeProps(
                makeNavigationItemProps(PrimaryNavigationGroup.EXPLORE),
                tourProps
              )}
            >
              <IconCompass />
            </SidebarLink>
          )}
        </NavigationTourElement>

        <Feature
          features={['discover', 'discover-query', 'dashboards-basic', 'dashboards-edit']}
          hookName="feature-disabled:dashboards-sidebar-item"
          requireAll={false}
        >
          <NavigationTourElement
            id={NavigationTour.DASHBOARDS}
            title={null}
            description={null}
          >
            {tourProps => (
              <SidebarLink
                to={`/${prefix}/dashboards/`}
                activeTo={`/${prefix}/dashboard`}
                analyticsKey="dashboards"
                group={PrimaryNavigationGroup.DASHBOARDS}
                {...mergeProps(
                  makeNavigationItemProps(PrimaryNavigationGroup.DASHBOARDS),
                  tourProps
                )}
              >
                <IconDashboard />
              </SidebarLink>
            )}
          </NavigationTourElement>
        </Feature>

        <Feature features={['performance-view']}>
          <NavigationTourElement
            id={NavigationTour.INSIGHTS}
            title={null}
            description={null}
          >
            {tourProps => (
              <SidebarLink
                to={`/${prefix}/insights/`}
                activeTo={`/${prefix}/insights`}
                analyticsKey="insights"
                group={PrimaryNavigationGroup.INSIGHTS}
                {...mergeProps(
                  makeNavigationItemProps(PrimaryNavigationGroup.INSIGHTS),
                  tourProps
                )}
              >
                <IconGraph type="area" />
              </SidebarLink>
            )}
          </NavigationTourElement>
        </Feature>

        {showPreventNavigation() ? (
          <Container position="relative" height="100%">
            <SidebarLink
              to={`/${prefix}/prevent/tests/`}
              activeTo={`/${prefix}/prevent/`}
              analyticsKey="prevent"
              group={PrimaryNavigationGroup.PREVENT}
              {...makeNavigationItemProps(PrimaryNavigationGroup.PREVENT)}
            >
              <IconPrevent />
            </SidebarLink>
            <BetaBadge type="beta" />
          </Container>
        ) : null}

        <SeparatorItem />

        <Feature features={['workflow-engine-ui']}>
          <Container position="relative" height="100%">
            <SidebarLink
              to={`/${prefix}/monitors/`}
              analyticsKey="monitors"
              group={PrimaryNavigationGroup.MONITORS}
              {...makeNavigationItemProps(PrimaryNavigationGroup.MONITORS)}
            >
              <IconSiren />
            </SidebarLink>
            <BetaBadge type="alpha" />
          </Container>
        </Feature>

        <NavigationTourElement
          id={NavigationTour.SETTINGS}
          title={null}
          description={null}
        >
          {tourProps => (
            <SidebarLink
              to={`/settings/${organization.slug}/`}
              activeTo="/settings/"
              analyticsKey="settings"
              group={PrimaryNavigationGroup.SETTINGS}
              {...mergeProps(
                makeNavigationItemProps(PrimaryNavigationGroup.SETTINGS),
                tourProps
              )}
            >
              <IconSettings />
            </SidebarLink>
          )}
        </NavigationTourElement>
      </SidebarBody>

      <Stack gap="md" marginTop="auto" paddingBottom="md">
        <SidebarFooter>
          <ErrorBoundary customComponent={null}>
            <PrimaryNavigationOnboarding />
          </ErrorBoundary>
          <ErrorBoundary customComponent={null}>
            <Hook name="sidebar:try-business" organization={organization} />
          </ErrorBoundary>
          <ErrorBoundary customComponent={null}>
            <Hook name="sidebar:seer-config-reminder" organization={organization} />
          </ErrorBoundary>
          <ErrorBoundary customComponent={null}>
            <Hook name="sidebar:billing-status" organization={organization} />
          </ErrorBoundary>
          <ErrorBoundary customComponent={null}>
            <PrimaryNavigationServiceIncidents />
          </ErrorBoundary>
          <ErrorBoundary customComponent={null}>
            <PrimaryNavigationWhatsNew />
          </ErrorBoundary>
          <PrimaryNavigationHelp />
        </SidebarFooter>
        <SidebarFooter>
          <UserDropdown />
        </SidebarFooter>
      </Stack>
    </Fragment>
  );
}

// Force all buttons to the same size
const FooterButtonBar = styled(ButtonBar)`
  & > button,
  & > span > button {
    width: ${p => p.theme.form.md.height};
    height: ${p => p.theme.form.md.height};
  }
`;

const BetaBadge = styled(FeatureBadge)`
  position: absolute;
  pointer-events: none;
  top: -2px;
  right: 2px;
  font-size: ${p => p.theme.font.size.xs};
  padding: 0 ${p => p.theme.space.xs};
  height: 16px;
`;
