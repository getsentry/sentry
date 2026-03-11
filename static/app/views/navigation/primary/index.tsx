import {Fragment} from 'react';
import {mergeProps} from '@react-aria/utils';

import {Container, Stack} from '@sentry/scraps/layout';

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
import {PrimaryNavigation} from 'sentry/views/navigation/components/primary';
import {
  NavigationTour,
  NavigationTourElement,
} from 'sentry/views/navigation/navigationTour';
import {PrimaryNavigationHelp} from 'sentry/views/navigation/primary/help';
import {PrimaryNavigationOnboarding} from 'sentry/views/navigation/primary/onboarding';
import {PrimaryNavigationServiceIncidents} from 'sentry/views/navigation/primary/serviceIncidents';
import {useActivateNavigationGroupOnHover} from 'sentry/views/navigation/primary/useActivateNavigationGroupOnHover';
import {UserDropdown} from 'sentry/views/navigation/primary/userDropdown';
import {PrimaryNavigationWhatsNew} from 'sentry/views/navigation/primary/whatsNew';
import {PrimaryNavigationGroup} from 'sentry/views/navigation/types';

function showPreventNavigation() {
  // only people with test analytics can see the prevent nav
  // Legacy Seer and New Seer orgs are getting a Seer Config Reminder icon, which
  // means that the only Prevent sub-nav item remaining is the Tests item.
  return false;
}

interface PrimaryNavigationItemsProps {
  makeNavigationItemProps?: ReturnType<typeof useActivateNavigationGroupOnHover>;
}

export function PrimaryNavigationItems(props: PrimaryNavigationItemsProps) {
  const organization = useOrganization();
  const prefix = `organizations/${organization.slug}`;
  const {makeNavigationItemProps} = props;

  return (
    <Fragment>
      <NavigationTourElement id={NavigationTour.ISSUES} title={null} description={null}>
        {tourProps => (
          <PrimaryNavigation.Link
            to={`/${prefix}/issues/`}
            analyticsKey="issues"
            group={PrimaryNavigationGroup.ISSUES}
            {...mergeProps(
              makeNavigationItemProps?.(PrimaryNavigationGroup.ISSUES),
              tourProps
            )}
          >
            <IconIssues />
          </PrimaryNavigation.Link>
        )}
      </NavigationTourElement>

      <NavigationTourElement id={NavigationTour.EXPLORE} title={null} description={null}>
        {tourProps => (
          <PrimaryNavigation.Link
            to={`/${prefix}/explore/${getDefaultExploreRoute(organization)}/`}
            activeTo={`/${prefix}/explore`}
            analyticsKey="explore"
            group={PrimaryNavigationGroup.EXPLORE}
            {...mergeProps(
              makeNavigationItemProps?.(PrimaryNavigationGroup.EXPLORE),
              tourProps
            )}
          >
            <IconCompass />
          </PrimaryNavigation.Link>
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
            <PrimaryNavigation.Link
              to={`/${prefix}/dashboards/`}
              activeTo={`/${prefix}/dashboard`}
              analyticsKey="dashboards"
              group={PrimaryNavigationGroup.DASHBOARDS}
              {...mergeProps(
                makeNavigationItemProps?.(PrimaryNavigationGroup.DASHBOARDS),
                tourProps
              )}
            >
              <IconDashboard />
            </PrimaryNavigation.Link>
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
            <PrimaryNavigation.Link
              to={`/${prefix}/insights/`}
              activeTo={`/${prefix}/insights`}
              analyticsKey="insights"
              group={PrimaryNavigationGroup.INSIGHTS}
              {...mergeProps(
                makeNavigationItemProps?.(PrimaryNavigationGroup.INSIGHTS),
                tourProps
              )}
            >
              <IconGraph type="area" />
            </PrimaryNavigation.Link>
          )}
        </NavigationTourElement>
      </Feature>

      {showPreventNavigation() ? (
        <Container position="relative" height="100%">
          <PrimaryNavigation.Link
            to={`/${prefix}/prevent/tests/`}
            activeTo={`/${prefix}/prevent/`}
            analyticsKey="prevent"
            group={PrimaryNavigationGroup.PREVENT}
            {...makeNavigationItemProps?.(PrimaryNavigationGroup.PREVENT)}
          >
            <IconPrevent />
          </PrimaryNavigation.Link>
          <PrimaryNavigation.FeatureBadge type="beta" />
        </Container>
      ) : null}

      <PrimaryNavigation.Separator orientation="horizontal" />

      <Feature features={['workflow-engine-ui']}>
        <PrimaryNavigation.Link
          to={`/${prefix}/monitors/`}
          analyticsKey="monitors"
          group={PrimaryNavigationGroup.MONITORS}
          {...makeNavigationItemProps?.(PrimaryNavigationGroup.MONITORS)}
        >
          <IconSiren />
          <PrimaryNavigation.FeatureBadge type="alpha" />
        </PrimaryNavigation.Link>
      </Feature>

      <NavigationTourElement id={NavigationTour.SETTINGS} title={null} description={null}>
        {tourProps => (
          <PrimaryNavigation.Link
            to={`/settings/${organization.slug}/`}
            activeTo="/settings/"
            analyticsKey="settings"
            group={PrimaryNavigationGroup.SETTINGS}
            {...mergeProps(
              makeNavigationItemProps?.(PrimaryNavigationGroup.SETTINGS),
              tourProps
            )}
          >
            <IconSettings />
          </PrimaryNavigation.Link>
        )}
      </NavigationTourElement>
    </Fragment>
  );
}
export function PrimaryNavigationSecondaryItems() {
  const organization = useOrganization();

  return (
    <Stack direction="column" gap="md">
      <PrimaryNavigation.Footer>
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
      </PrimaryNavigation.Footer>
      <PrimaryNavigation.Footer>
        <UserDropdown />
      </PrimaryNavigation.Footer>
    </Stack>
  );
}
