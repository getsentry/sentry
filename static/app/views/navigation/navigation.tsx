import {Fragment, type RefObject, useMemo, useRef} from 'react';
import {motion, type MotionProps} from 'framer-motion';

import {Stack} from '@sentry/scraps/layout';
import {Flex} from '@sentry/scraps/layout';
import {SizeProvider} from '@sentry/scraps/sizeContext';

import Feature from 'sentry/components/acl/feature';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {Override} from 'sentry/components/override';
import {
  IconCompass,
  IconDashboard,
  IconGraph,
  IconIssues,
  IconSettings,
  IconSiren,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {getDefaultExploreRoute} from 'sentry/views/explore/utils';
import {
  NAVIGATION_SIDEBAR_SECONDARY_WIDTH_LOCAL_STORAGE_KEY,
  PRIMARY_SIDEBAR_WIDTH,
  SECONDARY_SIDEBAR_WIDTH,
} from 'sentry/views/navigation/constants';
import {PrimaryNavigation} from 'sentry/views/navigation/primary/components';
import {PrimaryNavigationHelpMenu} from 'sentry/views/navigation/primary/helpMenu';
import {PrimaryNavigationOnboarding} from 'sentry/views/navigation/primary/onboarding';
import {OrganizationDropdown} from 'sentry/views/navigation/primary/organizationDropdown';
import {PrimaryNavigationServiceIncidents} from 'sentry/views/navigation/primary/serviceIncidents';
import {useActivateNavigationGroupOnHover} from 'sentry/views/navigation/primary/useActivateNavigationGroupOnHover';
import {UserDropdown} from 'sentry/views/navigation/primary/userDropdown';
import {PrimaryNavigationWhatsNew} from 'sentry/views/navigation/primary/whatsNew';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {SecondaryNavigationContent} from 'sentry/views/navigation/secondary/content';
import {useSecondaryNavigation} from 'sentry/views/navigation/secondaryNavigationContext';
import {useCollapsedNavigation} from 'sentry/views/navigation/useCollapsedNavigation';

export function Navigation() {
  const collapsedNavigation = useCollapsedNavigation();
  const {view} = useSecondaryNavigation();

  const ref = useRef<HTMLUListElement | null>(null);

  const {layout} = usePrimaryNavigation();

  const isCollapsed = view !== 'expanded';

  const [secondarySidebarWidth] = useSyncedLocalStorageState(
    NAVIGATION_SIDEBAR_SECONDARY_WIDTH_LOCAL_STORAGE_KEY,
    SECONDARY_SIDEBAR_WIDTH
  );

  const sidebarAnimationProps = useMemo(
    () =>
      makeCollapsedSecondaryWrapperAnimationProps(
        collapsedNavigation.view === 'peek',
        secondarySidebarWidth
      ),
    [collapsedNavigation.view, secondarySidebarWidth]
  );

  return (
    <Fragment>
      <PrimaryNavigation.Sidebar>
        <PrimaryNavigation.SidebarHeader>
          <OrganizationDropdown />
        </PrimaryNavigation.SidebarHeader>
        <PrimaryNavigation.List ref={ref}>
          <PrimaryNavigationItems listRef={ref} />
        </PrimaryNavigation.List>

        <SizeProvider size="sm">
          <Stack
            gap={layout === 'mobile' ? undefined : 'md'}
            marginTop="auto"
            paddingBottom="md"
          >
            <PrimaryNavigation.FooterItems>
              <PrimaryNavigationFooterItems />
            </PrimaryNavigation.FooterItems>
            <PrimaryNavigation.FooterItems>
              <PrimaryNavigationFooterItemsUserDropdown />
            </PrimaryNavigation.FooterItems>
          </Stack>
        </SizeProvider>
      </PrimaryNavigation.Sidebar>

      {isCollapsed ? (
        <CollapsedSecondaryWrapper
          data-visible={collapsedNavigation.view === 'peek'}
          data-test-id="collapsed-secondary-sidebar"
          height="100%"
          left={`${PRIMARY_SIDEBAR_WIDTH}px`}
          top={0}
          position="absolute"
          background="primary"
          {...sidebarAnimationProps}
        >
          <SecondaryNavigation.Sidebar>
            <SecondaryNavigationContent />
          </SecondaryNavigation.Sidebar>
        </CollapsedSecondaryWrapper>
      ) : (
        <SecondaryNavigation.Sidebar>
          <SecondaryNavigationContent />
        </SecondaryNavigation.Sidebar>
      )}
    </Fragment>
  );
}

interface PrimaryNavigationItemsProps {
  listRef?: RefObject<HTMLUListElement | null>;
}

export function PrimaryNavigationItems({listRef}: PrimaryNavigationItemsProps) {
  const organization = useOrganization();
  const prefix = `organizations/${organization.slug}`;

  const fallbackRef = useRef<HTMLUListElement>(null);

  const makeNavigationItemProps = useActivateNavigationGroupOnHover({
    ref: listRef ?? fallbackRef,
  });

  return (
    <Fragment>
      <PrimaryNavigation.ListItem>
        <PrimaryNavigation.Link
          to={`/${prefix}/issues/`}
          analyticsKey="issues"
          label={t('Issues')}
          {...makeNavigationItemProps('issues', `/${prefix}/issues/`)}
        >
          <IconIssues />
        </PrimaryNavigation.Link>
      </PrimaryNavigation.ListItem>

      <PrimaryNavigation.ListItem>
        <PrimaryNavigation.Link
          to={`/${prefix}/explore/${getDefaultExploreRoute(organization)}/`}
          analyticsKey="explore"
          label={t('Explore')}
          {...makeNavigationItemProps(
            'explore',
            `/${prefix}/explore/${getDefaultExploreRoute(organization)}/`,
            `/${prefix}/explore`
          )}
        >
          <IconCompass />
        </PrimaryNavigation.Link>
      </PrimaryNavigation.ListItem>

      <Feature
        features={['discover', 'discover-query', 'dashboards-basic', 'dashboards-edit']}
        overrideName="feature-disabled:dashboards-sidebar-item"
        requireAll={false}
      >
        <PrimaryNavigation.ListItem>
          <PrimaryNavigation.Link
            to={`/${prefix}/dashboards/`}
            analyticsKey="dashboards"
            label={t('Dashboards')}
            {...makeNavigationItemProps(
              'dashboards',
              `/${prefix}/dashboards/`,
              `/${prefix}/dashboard`
            )}
          >
            <IconDashboard />
          </PrimaryNavigation.Link>
        </PrimaryNavigation.ListItem>
      </Feature>

      {!organization.features.includes('insights-to-dashboards-ui-rollout') && (
        <Feature features={['performance-view']}>
          <PrimaryNavigation.ListItem>
            <PrimaryNavigation.Link
              to={`/${prefix}/insights/`}
              analyticsKey="insights"
              label={t('Insights')}
              {...makeNavigationItemProps(
                'insights',
                `/${prefix}/insights/`,
                `/${prefix}/insights`
              )}
            >
              <IconGraph type="area" />
            </PrimaryNavigation.Link>
          </PrimaryNavigation.ListItem>
        </Feature>
      )}

      <Feature features={['workflow-engine-ui']}>
        <PrimaryNavigation.ListItem>
          <PrimaryNavigation.Link
            to={`/${prefix}/monitors/`}
            analyticsKey="monitors"
            label={t('Monitors')}
            {...makeNavigationItemProps('monitors', `/${prefix}/monitors/`)}
          >
            <IconSiren />
          </PrimaryNavigation.Link>
        </PrimaryNavigation.ListItem>
      </Feature>

      <PrimaryNavigation.ListItem>
        <PrimaryNavigation.Link
          to={`/settings/${organization.slug}/`}
          analyticsKey="settings"
          label={t('Settings')}
          {...makeNavigationItemProps(
            'settings',
            `/settings/${organization.slug}/`,
            '/settings/'
          )}
        >
          <IconSettings />
        </PrimaryNavigation.Link>
      </PrimaryNavigation.ListItem>
    </Fragment>
  );
}

/**
 * Returns the list of items from the footer of the primary navigation
 */
export function PrimaryNavigationFooterItems() {
  const organization = useOrganization();

  return (
    <Fragment>
      <ErrorBoundary customComponent={null}>
        <PrimaryNavigationOnboarding />
      </ErrorBoundary>
      <ErrorBoundary customComponent={null}>
        <Override name="sidebar:try-business" organization={organization} />
      </ErrorBoundary>
      <ErrorBoundary customComponent={null}>
        <Override name="sidebar:seer-config-reminder" organization={organization} />
      </ErrorBoundary>
      <ErrorBoundary customComponent={null}>
        <Override name="sidebar:billing-status" organization={organization} />
      </ErrorBoundary>
      <ErrorBoundary customComponent={null}>
        <PrimaryNavigationServiceIncidents />
      </ErrorBoundary>
      <ErrorBoundary customComponent={null}>
        <PrimaryNavigationWhatsNew />
      </ErrorBoundary>
      <PrimaryNavigationHelpMenu />
    </Fragment>
  );
}

/**
 * Returns the user dropdown from the footer of the primary navigation
 */
export function PrimaryNavigationFooterItemsUserDropdown() {
  return <UserDropdown />;
}

const CollapsedSecondaryWrapper = motion.create(Flex);
const makeCollapsedSecondaryWrapperAnimationProps = (
  open: boolean,
  left: number
): MotionProps => {
  return {
    initial: 'hidden',
    animate: open ? 'visible' : 'hidden',
    variants: {
      visible: {x: 0},
      hidden: {x: -left - 10},
    },
    transition: {
      type: 'spring',
      damping: 50,
      stiffness: 700,
      bounce: 0,
      visualDuration: 0.1,
    },
  };
};
