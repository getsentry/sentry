import {Fragment, type RefObject, useMemo, useRef} from 'react';
import {mergeProps} from '@react-aria/utils';
import {motion, type MotionProps} from 'framer-motion';

import {Stack} from '@sentry/scraps/layout';
import {Flex} from '@sentry/scraps/layout';
import {SizeProvider} from '@sentry/scraps/sizeContext';

import {openCommandPalette} from 'sentry/actionCreators/modal';
import {openHelpSearchModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Hook from 'sentry/components/hook';
import {IconSearch} from 'sentry/icons';
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
import {
  NavigationTour,
  NavigationTourElement,
} from 'sentry/views/navigation/navigationTour';
import {
  useNavigationTour,
  useNavigationTourModal,
} from 'sentry/views/navigation/navigationTour';
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
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

export function Navigation() {
  const collapsedNavigation = useCollapsedNavigation();
  const hasPageFrame = useHasPageFrameFeature();
  const {view} = useSecondaryNavigation();

  const ref = useRef<HTMLUListElement | null>(null);

  const {layout} = usePrimaryNavigation();
  const isMobilePageFrame = hasPageFrame && layout === 'mobile';

  useNavigationTourModal();

  const {currentStepId} = useNavigationTour();
  const isCollapsed = currentStepId === null ? view !== 'expanded' : false;

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

        {!isMobilePageFrame && layout === 'mobile' ? null : (
          <SizeProvider size={hasPageFrame ? 'sm' : 'md'}>
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
        )}
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
  const hasPageFrame = useHasPageFrameFeature();

  const makeNavigationItemProps = useActivateNavigationGroupOnHover({
    ref: listRef ?? fallbackRef,
  });

  return (
    <Fragment>
      <NavigationTourElement id={NavigationTour.ISSUES} title={null} description={null}>
        {tourProps => (
          <PrimaryNavigation.ListItem>
            <PrimaryNavigation.Link
              to={`/${prefix}/issues/`}
              analyticsKey="issues"
              label={t('Issues')}
              {...mergeProps(
                makeNavigationItemProps('issues', `/${prefix}/issues/`),
                tourProps
              )}
            >
              <IconIssues />
            </PrimaryNavigation.Link>
          </PrimaryNavigation.ListItem>
        )}
      </NavigationTourElement>

      <NavigationTourElement id={NavigationTour.EXPLORE} title={null} description={null}>
        {tourProps => (
          <PrimaryNavigation.ListItem>
            <PrimaryNavigation.Link
              to={`/${prefix}/explore/${getDefaultExploreRoute(organization)}/`}
              analyticsKey="explore"
              label={t('Explore')}
              {...mergeProps(
                makeNavigationItemProps(
                  'explore',
                  `/${prefix}/explore/${getDefaultExploreRoute(organization)}/`,
                  `/${prefix}/explore`
                ),
                tourProps
              )}
            >
              <IconCompass />
            </PrimaryNavigation.Link>
          </PrimaryNavigation.ListItem>
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
            <PrimaryNavigation.ListItem>
              <PrimaryNavigation.Link
                to={`/${prefix}/dashboards/`}
                analyticsKey="dashboards"
                label={t('Dashboards')}
                {...mergeProps(
                  makeNavigationItemProps(
                    'dashboards',
                    `/${prefix}/dashboards/`,
                    `/${prefix}/dashboard`
                  ),
                  tourProps
                )}
              >
                <IconDashboard />
              </PrimaryNavigation.Link>
            </PrimaryNavigation.ListItem>
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
            <PrimaryNavigation.ListItem>
              <PrimaryNavigation.Link
                to={`/${prefix}/insights/`}
                analyticsKey="insights"
                label={t('Insights')}
                {...mergeProps(
                  makeNavigationItemProps(
                    'insights',
                    `/${prefix}/insights/`,
                    `/${prefix}/insights`
                  ),
                  tourProps
                )}
              >
                <IconGraph type="area" />
              </PrimaryNavigation.Link>
            </PrimaryNavigation.ListItem>
          )}
        </NavigationTourElement>
      </Feature>

      {hasPageFrame ? null : (
        <PrimaryNavigation.ListItem padding="0 md">
          <PrimaryNavigation.Separator />
        </PrimaryNavigation.ListItem>
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
            <PrimaryNavigation.ButtonFeatureBadge type="alpha" />
          </PrimaryNavigation.Link>
        </PrimaryNavigation.ListItem>
      </Feature>

      <NavigationTourElement id={NavigationTour.SETTINGS} title={null} description={null}>
        {tourProps => (
          <PrimaryNavigation.ListItem>
            <PrimaryNavigation.Link
              to={`/settings/${organization.slug}/`}
              analyticsKey="settings"
              label={t('Settings')}
              {...mergeProps(
                makeNavigationItemProps(
                  'settings',
                  `/settings/${organization.slug}/`,
                  '/settings/'
                ),
                tourProps
              )}
            >
              <IconSettings />
            </PrimaryNavigation.Link>
          </PrimaryNavigation.ListItem>
        )}
      </NavigationTourElement>
    </Fragment>
  );
}

/**
 * Returns the list of items from the footer of the primary navigation
 */
export function PrimaryNavigationFooterItems() {
  const organization = useOrganization();
  const hasPageFrame = useHasPageFrameFeature();

  return (
    <Fragment>
      {hasPageFrame ? (
        <PrimaryNavigation.Button
          label={t('Search support, docs and more')}
          analyticsKey="search"
          buttonProps={{
            icon: <IconSearch />,
            onClick: () =>
              organization.features.includes('cmd-k-supercharged')
                ? openCommandPalette()
                : openHelpSearchModal({organization}),
          }}
        />
      ) : null}
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
