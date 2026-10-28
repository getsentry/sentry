import {Fragment, type PropsWithChildren, type RefObject, useMemo, useRef} from 'react';
import {mergeProps} from '@react-aria/utils';
import {IconArrow} from '@sentry/icons/arrow';
import {IconBuilding} from '@sentry/icons/building';
import {IconCompass} from '@sentry/icons/compass';
import {IconDashboard} from '@sentry/icons/dashboard';
import {IconGraph} from '@sentry/icons/graph';
import {IconIssues} from '@sentry/icons/issues';
import {IconProject} from '@sentry/icons/project';
import {IconSeer} from '@sentry/icons/seer';
import {IconSettings} from '@sentry/icons/settings';
import {IconSiren} from '@sentry/icons/siren';
import {IconUser} from '@sentry/icons/user';
import {motion, type MotionProps} from 'framer-motion';

import {LinkButton} from '@sentry/scraps/button';
import {Stack, Flex} from '@sentry/scraps/layout';
import {SizeProvider} from '@sentry/scraps/sizeContext';

import Feature from 'sentry/components/acl/feature';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {Override} from 'sentry/components/override';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {getReturnPath} from 'sentry/utils/useReturnPath';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {getDefaultExploreRoute} from 'sentry/views/explore/utils';
import {
  getInvestigationsPath,
  useInvestigationsEnabled,
} from 'sentry/views/investigations/utils';
import {
  NAVIGATION_SIDEBAR_SECONDARY_WIDTH_LOCAL_STORAGE_KEY,
  PRIMARY_SIDEBAR_WIDTH,
  SECONDARY_SIDEBAR_WIDTH,
  getSettingsReturnPathKey,
} from 'sentry/views/navigation/constants';
import {
  NavigationTour,
  NavigationTourElement,
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
import {SettingsNavigationTourElement} from 'sentry/views/navigation/settingsNavigationTour';
import {useCollapsedNavigation} from 'sentry/views/navigation/useCollapsedNavigation';
import {useSettingsNavigation} from 'sentry/views/navigation/useSettingsNavigation';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';
import {
  getAutomationsPath,
  useAutomationsEnabled,
} from 'sentry/views/seerWorkflows/utils';
import {useSettingsScope} from 'sentry/views/settings/useSettingsScope';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

function NavigationImpl() {
  const organization = useOrganization({allowNull: true});
  const isSettingsNavigation = useSettingsNavigation();
  const collapsedNavigation = useCollapsedNavigation();
  const {view} = useSecondaryNavigation();

  const ref = useRef<HTMLUListElement | null>(null);

  const {layout, activeGroup} = usePrimaryNavigation();

  useNavigationTourModal();

  const {currentStepId} = useNavigationTour();
  // The tour forces the sidebar open regardless of `view`, so this — not
  // `view !== 'expanded'` alone — is the actual collapsed state on screen.
  const isCollapsed = currentStepId === null ? view !== 'expanded' : false;

  useLLMContext({
    contextHint:
      "The org's left-hand navigation sidebar — a primary icon rail (Issues, " +
      'Explore, Dashboards, Insights, Monitors, Settings, ...) plus a secondary ' +
      'panel for whichever group is active. Child nodes carry each active ' +
      "secondary panel's own detail (starred views/queries/dashboards, issue " +
      'counts, settings categories, etc).',
    activeGroup,
    isCollapsed,
  });

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
          {isSettingsNavigation && organization ? (
            <SettingsNavigationBackButton organizationSlug={organization.slug} />
          ) : organization ? (
            <OrganizationDropdown />
          ) : (
            <UserDropdown />
          )}
        </PrimaryNavigation.SidebarHeader>
        <PrimaryNavigation.List ref={ref}>
          {isSettingsNavigation && organization ? (
            <SettingsPrimaryNavigationItems organizationSlug={organization.slug} />
          ) : (
            <PrimaryNavigationItems listRef={ref} />
          )}
        </PrimaryNavigation.List>

        {organization && (
          <SizeProvider size="sm">
            <Stack
              gap={layout === 'mobile' ? undefined : 'md'}
              marginTop="auto"
              paddingBottom="md"
            >
              <PrimaryNavigation.FooterItems>
                <PrimaryNavigationFooterItems>
                  <ErrorBoundary customComponent={null}>
                    <PrimaryNavigationWhatsNew />
                  </ErrorBoundary>
                  <PrimaryNavigationHelpMenu />
                </PrimaryNavigationFooterItems>
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

export const Navigation = registerLLMContext('navigation', NavigationImpl);

export function SettingsNavigationBackButton({
  organizationSlug,
}: {
  organizationSlug: string;
}) {
  const {setActiveGroup} = usePrimaryNavigation();
  return (
    <SettingsNavigationTourElement id="back">
      {tourProps => (
        <LinkButton
          {...tourProps}
          size="sm"
          icon={<IconArrow direction="left" />}
          aria-label={t('Back to app')}
          tooltipProps={{title: t('Back to app')}}
          to={getReturnPath(
            getSettingsReturnPathKey(organizationSlug),
            `/organizations/${organizationSlug}/issues/`
          )}
          onClick={() => setActiveGroup(null)}
        />
      )}
    </SettingsNavigationTourElement>
  );
}

export function SettingsPrimaryNavigationItems({
  organizationSlug,
}: {
  organizationSlug: string;
}) {
  const {projects} = useProjects();
  const {scope: activeScope, projectSlug: activeProjectSlug} = useSettingsScope();
  const projectSlug = activeProjectSlug ?? projects[0]?.slug;
  const projectSettingsPath = `/settings/${organizationSlug}/projects/`;
  const items = [
    {
      key: 'org' as const,
      label: t('Org'),
      to: `/settings/${organizationSlug}/`,
      icon: <IconBuilding />,
    },
    {
      key: 'project' as const,
      label: t('Project'),
      to: projectSlug ? `${projectSettingsPath}${projectSlug}/` : projectSettingsPath,
      icon: <IconProject />,
    },
    {
      key: 'account' as const,
      label: t('Account'),
      to: '/settings/account/',
      icon: <IconUser />,
    },
  ];

  return items.map(({key, label, to, icon}) => (
    <SettingsNavigationTourElement key={to} id={key}>
      {tourProps => (
        <PrimaryNavigation.ListItem {...tourProps}>
          <PrimaryNavigation.Link
            to={to}
            analyticsKey={`settings-${key}`}
            label={label}
            aria-current={key === activeScope ? 'location' : undefined}
          >
            {icon}
          </PrimaryNavigation.Link>
        </PrimaryNavigation.ListItem>
      )}
    </SettingsNavigationTourElement>
  ));
}

interface PrimaryNavigationItemsProps {
  listRef?: RefObject<HTMLUListElement | null>;
}

export function PrimaryNavigationItems({listRef}: PrimaryNavigationItemsProps) {
  const organization = useOrganization({allowNull: true});
  const investigationsEnabled = useInvestigationsEnabled();
  const automationsEnabled = useAutomationsEnabled();
  const settingsV3 = useSettingsV3();

  const fallbackRef = useRef<HTMLUListElement>(null);

  const makeNavigationItemProps = useActivateNavigationGroupOnHover({
    ref: listRef ?? fallbackRef,
  });

  const settingsPath = organization
    ? `/settings/${organization.slug}/`
    : '/settings/account/';
  const settingsItem = (
    <NavigationTourElement id={NavigationTour.SETTINGS} title={null} description={null}>
      {tourProps => (
        <PrimaryNavigation.ListItem>
          <PrimaryNavigation.Link
            to={settingsPath}
            analyticsKey="settings"
            label={t('Settings')}
            {...mergeProps(
              makeNavigationItemProps('settings', settingsPath, '/settings/'),
              tourProps
            )}
          >
            <IconSettings />
          </PrimaryNavigation.Link>
        </PrimaryNavigation.ListItem>
      )}
    </NavigationTourElement>
  );

  if (!organization) {
    return settingsItem;
  }

  const seerPath = automationsEnabled
    ? getAutomationsPath(organization.slug)
    : getInvestigationsPath(organization.slug);

  const prefix = `organizations/${organization.slug}`;

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

      {organization.features.includes('seer-primary-nav') &&
        (investigationsEnabled || automationsEnabled) && (
          <PrimaryNavigation.ListItem>
            <PrimaryNavigation.Link
              to={seerPath}
              analyticsKey="seer"
              label={t('Seer')}
              {...makeNavigationItemProps('seer', seerPath, `/${prefix}/seer`)}
            >
              <IconSeer />
            </PrimaryNavigation.Link>
          </PrimaryNavigation.ListItem>
        )}

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
                  [`/${prefix}/explore`]
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
        overrideName="feature-disabled:dashboards-sidebar-item"
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

      {!organization.features.includes('insights-to-dashboards-ui-rollout') && (
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
      )}

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

      {settingsV3 ? null : settingsItem}
    </Fragment>
  );
}

/**
 * Returns the list of items from the footer of the primary navigation
 */
export function PrimaryNavigationFooterItems({children}: PropsWithChildren) {
  const organization = useOrganization({allowNull: true});

  if (!organization) {
    return children;
  }

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
      {children}
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
