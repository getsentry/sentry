import {Fragment, type PropsWithChildren, useEffect} from 'react';
import {mergeProps} from '@react-aria/utils';
import {IconArrow} from '@sentry/icons/arrow';
import {IconCompass} from '@sentry/icons/compass';
import {IconDashboard} from '@sentry/icons/dashboard';
import {IconGraph} from '@sentry/icons/graph';
import {IconIssues} from '@sentry/icons/issues';
import {IconMail} from '@sentry/icons/mail';
import {IconSeer} from '@sentry/icons/seer';
import {IconSettings} from '@sentry/icons/settings';
import {IconSiren} from '@sentry/icons/siren';

import {LinkButton} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {SizeProvider} from '@sentry/scraps/sizeContext';

import {Feature} from 'sentry/components/acl/feature';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {Override} from 'sentry/components/override';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {getInboxPath, getOrganizationHomePath} from 'sentry/utils/organizationHomePath';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {getReturnPath} from 'sentry/utils/useReturnPath';
import {getClassifiersPath, useClassifiersEnabled} from 'sentry/views/classifiers/utils';
import {getDefaultExploreRoute} from 'sentry/views/explore/utils';
import {
  getInvestigationsPath,
  useInvestigationsEnabled,
} from 'sentry/views/investigations/utils';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';
import {
  getAutomationsPath,
  useAutomationsEnabled,
} from 'sentry/views/seerWorkflows/utils';
import {
  getSettingsScopeIcon,
  type SettingsScope,
} from 'sentry/views/settings/settingsScope';
import {useSettingsScope} from 'sentry/views/settings/useSettingsScope';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

import {PrimaryNavigationCommandPalette} from './primary/commandPalette';
import {PrimaryNavigation} from './primary/components';
import {PrimaryNavigationHelpMenu} from './primary/helpMenu';
import {PrimaryNavigationOnboarding} from './primary/onboarding';
import {OrganizationDropdown} from './primary/organizationDropdown';
import {PrimaryNavigationServiceIncidents} from './primary/serviceIncidents';
import {useActivateNavigationGroup} from './primary/useActivateNavigationGroup';
import {UserDropdown} from './primary/userDropdown';
import {PrimaryNavigationWhatsNew} from './primary/whatsNew';
import {SecondaryNavigation} from './secondary/components';
import {SecondaryNavigationContent} from './secondary/content';
import {getSettingsLastProjectKey, getSettingsReturnPathKey} from './constants';
import {
  NavigationTour,
  NavigationTourElement,
  useNavigationTour,
  useNavigationTourModal,
} from './navigationTour';
import {hasSecondaryNavigation, usePrimaryNavigation} from './primaryNavigationContext';
import {useSecondaryNavigation} from './secondaryNavigationContext';
import {useSettingsNavigation} from './useSettingsNavigation';

function NavigationImpl() {
  const organization = useOrganization({allowNull: true});
  const isSettingsNavigation = useSettingsNavigation();
  const settingsV3 = useSettingsV3();
  const {view} = useSecondaryNavigation();

  const {layout, activeGroup} = usePrimaryNavigation();

  useNavigationTourModal();

  const {currentStepId} = useNavigationTour();
  // The tour forces the sidebar open regardless of `view`, so this — not
  // `view !== 'expanded'` alone — is the actual collapsed state on screen.
  const isCollapsed =
    currentStepId === null
      ? view !== 'expanded' || !hasSecondaryNavigation(activeGroup)
      : false;

  useLLMContext({
    contextHint: isSettingsNavigation
      ? "The settings navigation sidebar — a primary icon rail with a 'Back to app' " +
        'button and the Org, Project and Account settings scopes, plus a secondary ' +
        'panel listing the settings pages of the active scope. Child nodes carry ' +
        "the secondary panel's own detail."
      : "The org's left-hand navigation sidebar — a primary icon rail (Issues, " +
        `Explore, Dashboards, Insights, Monitors${settingsV3 ? '' : ', Settings'}, ...) ` +
        'plus a secondary panel for whichever group is active. Child nodes carry ' +
        "each active secondary panel's own detail (starred views/queries/dashboards, " +
        'issue counts, settings categories, etc).',
    activeGroup,
    isCollapsed,
  });

  return (
    <Fragment>
      <PrimaryNavigation.Sidebar>
        <PrimaryNavigation.SidebarHeader>
          {isSettingsNavigation && organization ? (
            <SettingsNavigationBackButton organization={organization} />
          ) : organization ? (
            <OrganizationDropdown />
          ) : (
            <UserDropdown />
          )}
        </PrimaryNavigation.SidebarHeader>
        <PrimaryNavigation.List>
          {isSettingsNavigation && organization ? (
            <SettingsPrimaryNavigationItems organizationSlug={organization.slug} />
          ) : (
            <PrimaryNavigationItems />
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
                <PrimaryNavigationCommandPalette />
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

      {isCollapsed ? null : (
        <SecondaryNavigation.Sidebar>
          <SecondaryNavigationContent />
        </SecondaryNavigation.Sidebar>
      )}
    </Fragment>
  );
}

export const Navigation = registerLLMContext('navigation', NavigationImpl);

export function SettingsNavigationBackButton({
  organization,
}: {
  organization: Organization;
}) {
  const {setActiveGroup, layout} = usePrimaryNavigation();
  const {setView} = useSecondaryNavigation();
  return (
    <LinkButton
      size="sm"
      icon={<IconArrow direction="left" />}
      aria-label={t('Back to app')}
      analyticsEventKey="settings.back_to_app_clicked"
      analyticsEventName="Settings: Back to App Clicked"
      tooltipProps={{title: t('Back to app')}}
      to={getReturnPath(
        getSettingsReturnPathKey(organization.slug),
        getOrganizationHomePath(organization)
      )}
      onClick={() => {
        setActiveGroup(null);
        if (layout === 'mobile') {
          setView('collapsed');
        }
      }}
    />
  );
}

export function SettingsPrimaryNavigationItems({
  organizationSlug,
}: {
  organizationSlug: string;
}) {
  const {projects} = useProjects();
  const {scope: activeScope, projectSlug: activeProjectSlug} = useSettingsScope();
  // Stored by ID, not slug, so renaming the project does not lose it.
  const [lastProjectId, setLastProjectId] = useLocalStorageState<string | null>(
    getSettingsLastProjectKey(organizationSlug),
    null
  );
  const activeProjectId = projects.find(({slug}) => slug === activeProjectSlug)?.id;

  useEffect(() => {
    if (activeProjectId && activeProjectId !== lastProjectId) {
      setLastProjectId(activeProjectId);
    }
  }, [activeProjectId, lastProjectId, setLastProjectId]);

  // The remembered project can be deleted or lose access since it was stored.
  const rememberedProjectSlug = projects.find(({id}) => id === lastProjectId)?.slug;
  const projectSlug = activeProjectSlug ?? rememberedProjectSlug ?? projects[0]?.slug;
  const projectSettingsPath = `/settings/${organizationSlug}/projects/`;
  const items: Array<{key: SettingsScope; label: string; to: string}> = [
    {key: 'org', label: t('Org'), to: `/settings/${organizationSlug}/`},
    {
      key: 'project',
      label: t('Project'),
      to: projectSlug ? `${projectSettingsPath}${projectSlug}/` : projectSettingsPath,
    },
    {key: 'account', label: t('Account'), to: '/settings/account/'},
  ];

  return items.map(({key, label, to}) => (
    <PrimaryNavigation.ListItem key={to}>
      <PrimaryNavigation.Link
        to={to}
        analyticsKey={`settings-${key}`}
        label={label}
        aria-current={key === activeScope ? 'location' : undefined}
      >
        {getSettingsScopeIcon(key)}
      </PrimaryNavigation.Link>
    </PrimaryNavigation.ListItem>
  ));
}

export function PrimaryNavigationItems() {
  const organization = useOrganization({allowNull: true});
  const investigationsEnabled = useInvestigationsEnabled();
  const automationsEnabled = useAutomationsEnabled();
  const classifiersEnabled = useClassifiersEnabled();
  const settingsV3 = useSettingsV3();

  const makeNavigationItemProps = useActivateNavigationGroup();

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
    : investigationsEnabled
      ? getInvestigationsPath(organization.slug)
      : getClassifiersPath(organization.slug);

  const prefix = `organizations/${organization.slug}`;
  const inboxPath = getInboxPath(organization);

  return (
    <Fragment>
      {inboxPath && (
        <PrimaryNavigation.ListItem>
          <PrimaryNavigation.Link
            to={inboxPath}
            analyticsKey="inbox"
            label={t('Inbox')}
            {...makeNavigationItemProps('inbox', inboxPath)}
          >
            <IconMail />
          </PrimaryNavigation.Link>
        </PrimaryNavigation.ListItem>
      )}
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
        (investigationsEnabled || automationsEnabled || classifiersEnabled) && (
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
