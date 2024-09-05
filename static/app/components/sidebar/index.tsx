import {Fragment, useCallback, useContext, useEffect} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {hideSidebar, showSidebar} from 'sentry/actionCreators/preferences';
import Feature from 'sentry/components/acl/feature';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {Chevron} from 'sentry/components/chevron';
import FeedbackOnboardingSidebar from 'sentry/components/feedback/feedbackOnboarding/sidebar';
import Hook from 'sentry/components/hook';
import {OnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {getMergedTasks} from 'sentry/components/onboardingWizard/taskConfig';
import PerformanceOnboardingSidebar from 'sentry/components/performanceOnboarding/sidebar';
import ReplaysOnboardingSidebar from 'sentry/components/replaysOnboarding/sidebar';
import {
  ExpandedContext,
  ExpandedContextProvider,
} from 'sentry/components/sidebar/expandedContextProvider';
import {isDone} from 'sentry/components/sidebar/utils';
import {
  IconDashboard,
  IconGraph,
  IconIssues,
  IconLightning,
  IconMegaphone,
  IconProject,
  IconReleases,
  IconSearch,
  IconSettings,
  IconSiren,
  IconStats,
  IconSupport,
  IconTimer,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import DemoWalkthroughStore from 'sentry/stores/demoWalkthroughStore';
import HookStore from 'sentry/stores/hookStore';
import PreferencesStore from 'sentry/stores/preferencesStore';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {isDemoWalkthrough} from 'sentry/utils/demoMode';
import {getDiscoverLandingUrl} from 'sentry/utils/discover/urls';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {hasCustomMetrics} from 'sentry/utils/metrics/features';
import theme from 'sentry/utils/theme';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useModuleURLBuilder} from 'sentry/views/insights/common/utils/useModuleURL';
import {MODULE_SIDEBAR_TITLE as HTTP_MODULE_SIDEBAR_TITLE} from 'sentry/views/insights/http/settings';
import {MODULE_TITLES} from 'sentry/views/insights/settings';
import MetricsOnboardingSidebar from 'sentry/views/metrics/ddmOnboarding/sidebar';

import {ProfilingOnboardingSidebar} from '../profiling/profilingOnboardingSidebar';

import Broadcasts from './broadcasts';
import SidebarHelp from './help';
import OnboardingStatus from './onboardingStatus';
import ServiceIncidents from './serviceIncidents';
import {SidebarAccordion} from './sidebarAccordion';
import SidebarDropdown from './sidebarDropdown';
import SidebarItem from './sidebarItem';
import type {SidebarOrientation} from './types';
import {SidebarPanelKey} from './types';

function activatePanel(panel: SidebarPanelKey) {
  SidebarPanelStore.activatePanel(panel);
}

function togglePanel(panel: SidebarPanelKey) {
  SidebarPanelStore.togglePanel(panel);
}

function hidePanel(hash?: string) {
  SidebarPanelStore.hidePanel(hash);
}

function useOpenOnboardingSidebar(organization?: Organization) {
  const onboardingContext = useContext(OnboardingContext);
  const {projects: project} = useProjects();
  const location = useLocation();

  const openOnboardingSidebar = (() => {
    if (location?.hash === '#welcome') {
      if (organization && !ConfigStore.get('demoMode')) {
        const tasks = getMergedTasks({
          organization,
          projects: project,
          onboardingContext,
        });

        const allDisplayedTasks = tasks
          .filter(task => task.display)
          .filter(task => !task.renderCard);
        const doneTasks = allDisplayedTasks.filter(isDone);

        return !(doneTasks.length >= allDisplayedTasks.length);
      }
      return true;
    }
    return false;
  })();

  useEffect(() => {
    if (openOnboardingSidebar) {
      activatePanel(SidebarPanelKey.ONBOARDING_WIZARD);
    }
  }, [openOnboardingSidebar]);
}

function Sidebar() {
  const location = useLocation();
  const preferences = useLegacyStore(PreferencesStore);
  const activePanel = useLegacyStore(SidebarPanelStore);
  const organization = useOrganization({allowNull: true});
  const {shouldAccordionFloat} = useContext(ExpandedContext);
  const hasNewNav = organization?.features.includes('navigation-sidebar-v2');
  const hasOrganization = !!organization;
  const isSelfHostedErrorsOnly = ConfigStore.get('isSelfHostedErrorsOnly');

  const collapsed = hasNewNav ? true : !!preferences.collapsed;
  const horizontal = useMedia(`(max-width: ${theme.breakpoints.medium})`);
  // Panel determines whether to highlight
  const hasPanel = !!activePanel;
  const orientation: SidebarOrientation = horizontal ? 'top' : 'left';

  const sidebarItemProps = {
    orientation,
    collapsed,
    hasPanel,
    organization,
    hasNewNav,
  };
  // Avoid showing superuser UI on self-hosted instances
  const showSuperuserWarning = () => {
    return isActiveSuperuser() && !ConfigStore.get('isSelfHosted');
  };

  // Avoid showing superuser UI on certain organizations
  const isExcludedOrg = () => {
    return HookStore.get('component:superuser-warning-excluded')[0]?.(organization);
  };

  useOpenOnboardingSidebar();

  const toggleCollapse = useCallback(() => {
    if (collapsed) {
      showSidebar();
    } else {
      hideSidebar();
    }
  }, [collapsed]);

  // Close panel on any navigation
  useEffect(() => void hidePanel(), [location?.pathname]);

  // Add classname to body
  useEffect(() => {
    const bcl = document.body.classList;

    bcl.add('body-sidebar');
    return () => bcl.remove('body-sidebar');
  }, []);

  useEffect(() => {
    Object.values(SidebarPanelKey).forEach(key => {
      if (location?.hash === `#sidebar-${key}`) {
        togglePanel(key);
      }
    });
  }, [location?.hash]);

  // Add sidebar collapse classname to body
  useEffect(() => {
    const bcl = document.body.classList;

    if (collapsed) {
      bcl.add('collapsed');
    } else {
      bcl.remove('collapsed');
    }

    return () => bcl.remove('collapsed');
  }, [collapsed]);

  // Add sidebar hasNewNav classname to body
  useEffect(() => {
    const bcl = document.body.classList;

    if (hasNewNav) {
      bcl.add('hasNewNav');
    } else {
      bcl.remove('hasNewNav');
    }

    return () => bcl.remove('hasNewNav');
  }, [hasNewNav]);

  const sidebarAnchor = isDemoWalkthrough() ? (
    <GuideAnchor target="projects" disabled={!DemoWalkthroughStore.get('sidebar')}>
      {t('Projects')}
    </GuideAnchor>
  ) : (
    <GuideAnchor target="projects">{t('Projects')}</GuideAnchor>
  );

  const projects = hasOrganization && (
    <SidebarItem
      {...sidebarItemProps}
      index
      icon={<IconProject />}
      label={sidebarAnchor}
      to={`/organizations/${organization.slug}/projects/`}
      id="projects"
    />
  );

  const issues = hasOrganization && (
    <SidebarItem
      {...sidebarItemProps}
      icon={<IconIssues />}
      label={<GuideAnchor target="issues">{t('Issues')}</GuideAnchor>}
      to={`/organizations/${organization.slug}/issues/`}
      search="?referrer=sidebar"
      id="issues"
      hasNewNav={hasNewNav}
    />
  );

  const discover2 = hasOrganization && (
    <Feature
      hookName="feature-disabled:discover2-sidebar-item"
      features="discover-basic"
      organization={organization}
    >
      <SidebarItem
        {...sidebarItemProps}
        icon={<SubitemDot collapsed />}
        label={<GuideAnchor target="discover">{t('Discover')}</GuideAnchor>}
        to={getDiscoverLandingUrl(organization)}
        id="discover-v2"
      />
    </Feature>
  );

  const moduleURLBuilder = useModuleURLBuilder(true);

  const queries = hasOrganization && (
    <Feature key="db" features="insights-entry-points" organization={organization}>
      <SidebarItem
        {...sidebarItemProps}
        label={
          <GuideAnchor target="performance-database">{MODULE_TITLES.db}</GuideAnchor>
        }
        to={`/organizations/${organization.slug}/${moduleURLBuilder('db')}/`}
        id="performance-database"
        icon={<SubitemDot collapsed />}
      />
    </Feature>
  );

  const requests = hasOrganization && (
    <Feature key="http" features="insights-entry-points" organization={organization}>
      <SidebarItem
        {...sidebarItemProps}
        label={
          <GuideAnchor target="performance-http">{HTTP_MODULE_SIDEBAR_TITLE}</GuideAnchor>
        }
        to={`/organizations/${organization.slug}/${moduleURLBuilder('http')}/`}
        id="performance-http"
        icon={<SubitemDot collapsed />}
      />
    </Feature>
  );

  const caches = hasOrganization && (
    <Feature key="cache" features="insights-entry-points" organization={organization}>
      <SidebarItem
        {...sidebarItemProps}
        label={
          <GuideAnchor target="performance-cache">{MODULE_TITLES.cache}</GuideAnchor>
        }
        to={`/organizations/${organization.slug}/${moduleURLBuilder('cache')}/`}
        id="performance-cache"
        icon={<SubitemDot collapsed />}
      />
    </Feature>
  );

  const webVitals = hasOrganization && (
    <Feature key="vital" features="insights-entry-points" organization={organization}>
      <SidebarItem
        {...sidebarItemProps}
        label={
          <GuideAnchor target="performance-webvitals">{MODULE_TITLES.vital}</GuideAnchor>
        }
        to={`/organizations/${organization.slug}/${moduleURLBuilder('vital')}/`}
        id="performance-webvitals"
        icon={<SubitemDot collapsed />}
      />
    </Feature>
  );

  const queues = hasOrganization && (
    <Feature key="queue" features="insights-entry-points" organization={organization}>
      <SidebarItem
        {...sidebarItemProps}
        label={
          <GuideAnchor target="performance-queues">{MODULE_TITLES.queue}</GuideAnchor>
        }
        to={`/organizations/${organization.slug}/${moduleURLBuilder('queue')}/`}
        id="performance-queues"
        icon={<SubitemDot collapsed />}
      />
    </Feature>
  );

  // the mobile screens module is meant to be as a replacement for screen load, app start, and mobile ui
  // so if mobile screens is enabled, we should not show the other mobile modules
  const hasMobileScreensModule =
    hasOrganization && organization.features.includes('insights-mobile-screens-module');

  const screenLoads = hasOrganization && !hasMobileScreensModule && (
    <Feature
      key="screen_load"
      features="insights-entry-points"
      organization={organization}
    >
      <SidebarItem
        {...sidebarItemProps}
        label={MODULE_TITLES.screen_load}
        to={`/organizations/${organization.slug}/${moduleURLBuilder('screen_load')}/`}
        id="performance-mobile-screens"
        icon={<SubitemDot collapsed />}
      />
    </Feature>
  );

  const appStarts = hasOrganization && !hasMobileScreensModule && (
    <Feature key="app_start" features="insights-entry-points" organization={organization}>
      <SidebarItem
        {...sidebarItemProps}
        label={MODULE_TITLES.app_start}
        to={`/organizations/${organization.slug}/${moduleURLBuilder('app_start')}/`}
        id="performance-mobile-app-startup"
        icon={<SubitemDot collapsed />}
      />
    </Feature>
  );

  const mobileUI = hasOrganization && !hasMobileScreensModule && (
    <Feature
      key="mobile-ui"
      features={['insights-entry-points', 'starfish-mobile-ui-module']}
      organization={organization}
    >
      <SidebarItem
        {...sidebarItemProps}
        label={MODULE_TITLES['mobile-ui']}
        to={`/organizations/${organization.slug}/${moduleURLBuilder('mobile-ui')}/`}
        id="performance-mobile-ui"
        icon={<SubitemDot collapsed />}
        isAlpha
      />
    </Feature>
  );

  const mobileScreens = hasOrganization && hasMobileScreensModule && (
    <Feature
      key="mobile-screens"
      features={['insights-entry-points']}
      organization={organization}
    >
      <SidebarItem
        {...sidebarItemProps}
        label={MODULE_TITLES['mobile-screens']}
        to={`/organizations/${organization.slug}/${moduleURLBuilder('mobile-screens')}/`}
        id="performance-mobile-screens"
        icon={<SubitemDot collapsed />}
      />
    </Feature>
  );

  const resources = hasOrganization && (
    <Feature key="resource" features="insights-entry-points">
      <SidebarItem
        {...sidebarItemProps}
        label={<GuideAnchor target="starfish">{MODULE_TITLES.resource}</GuideAnchor>}
        to={`/organizations/${organization.slug}/${moduleURLBuilder('resource')}/`}
        id="performance-browser-resources"
        icon={<SubitemDot collapsed />}
      />
    </Feature>
  );

  const traces = hasOrganization && (
    <Feature features="performance-trace-explorer">
      <SidebarItem
        {...sidebarItemProps}
        label={<GuideAnchor target="traces">{t('Traces')}</GuideAnchor>}
        to={`/organizations/${organization.slug}/traces/`}
        id="performance-trace-explorer"
        icon={<SubitemDot collapsed />}
        isBeta
      />
    </Feature>
  );

  const llmMonitoring = hasOrganization && (
    <Feature features={['insights-entry-points']} organization={organization}>
      <SidebarItem
        {...sidebarItemProps}
        icon={<SubitemDot collapsed />}
        label={MODULE_TITLES.ai}
        to={`/organizations/${organization.slug}/${moduleURLBuilder('ai')}/`}
        id="llm-monitoring"
      />
    </Feature>
  );

  const performance = hasOrganization && (
    <Feature
      hookName="feature-disabled:performance-sidebar-item"
      features="performance-view"
      organization={organization}
    >
      <SidebarItem
        {...sidebarItemProps}
        icon={<IconLightning />}
        label={
          <GuideAnchor target="performance">
            {hasNewNav ? 'Perf.' : t('Performance')}
          </GuideAnchor>
        }
        to={`/organizations/${organization.slug}/performance/`}
        id="performance"
      />
    </Feature>
  );

  const releases = hasOrganization && (
    <SidebarItem
      {...sidebarItemProps}
      icon={<IconReleases />}
      label={<GuideAnchor target="releases">{t('Releases')}</GuideAnchor>}
      to={`/organizations/${organization.slug}/releases/`}
      id="releases"
    />
  );

  const userFeedback = hasOrganization && (
    <Feature features="old-user-feedback" organization={organization}>
      <SidebarItem
        {...sidebarItemProps}
        icon={<IconSupport />}
        label={t('User Feedback')}
        to={`/organizations/${organization.slug}/user-feedback/`}
        id="user-feedback"
      />
    </Feature>
  );

  const feedback = hasOrganization && (
    <Feature features="user-feedback-ui" organization={organization}>
      <SidebarItem
        {...sidebarItemProps}
        icon={<IconMegaphone />}
        label={t('User Feedback')}
        variant="short"
        to={`/organizations/${organization.slug}/feedback/`}
        id="feedback"
      />
    </Feature>
  );

  const alerts = hasOrganization && (
    <SidebarItem
      {...sidebarItemProps}
      icon={<IconSiren />}
      label={t('Alerts')}
      to={`/organizations/${organization.slug}/alerts/rules/`}
      id="alerts"
    />
  );

  const monitors = hasOrganization && (
    <SidebarItem
      {...sidebarItemProps}
      icon={<IconTimer />}
      label={t('Crons')}
      to={`/organizations/${organization.slug}/crons/`}
      id="crons"
    />
  );

  const replays = hasOrganization && (
    <Feature
      hookName="feature-disabled:replay-sidebar-item"
      features="session-replay-ui"
      organization={organization}
      requireAll={false}
    >
      <SidebarItem
        {...sidebarItemProps}
        icon={<SubitemDot collapsed />}
        label={t('Replays')}
        to={`/organizations/${organization.slug}/replays/`}
        id="replays"
      />
    </Feature>
  );

  const metricsPath = `/organizations/${organization?.slug}/metrics/`;

  const metrics = hasOrganization && hasCustomMetrics(organization) && (
    <SidebarItem
      {...sidebarItemProps}
      icon={<SubitemDot collapsed />}
      label={t('Metrics')}
      to={metricsPath}
      search={location?.pathname === normalizeUrl(metricsPath) ? location.search : ''}
      id="metrics"
      badgeTitle={t(
        'The Metrics beta will end and we will retire the current solution on October 7th, 2024'
      )}
      isBeta
    />
  );

  const dashboards = hasOrganization && (
    <Feature
      hookName="feature-disabled:dashboards-sidebar-item"
      features={['discover', 'discover-query', 'dashboards-basic', 'dashboards-edit']}
      organization={organization}
      requireAll={false}
    >
      <SidebarItem
        {...sidebarItemProps}
        index
        icon={<IconDashboard />}
        label={hasNewNav ? 'Dash.' : t('Dashboards')}
        to={`/organizations/${organization.slug}/dashboards/`}
        id="customizable-dashboards"
      />
    </Feature>
  );

  const profiling = hasOrganization && (
    <Feature
      hookName="feature-disabled:profiling-sidebar-item"
      features="profiling"
      organization={organization}
      requireAll={false}
    >
      <SidebarItem
        {...sidebarItemProps}
        index
        icon={<SubitemDot collapsed />}
        label={t('Profiles')}
        to={`/organizations/${organization.slug}/profiling/`}
        id="profiling"
      />
    </Feature>
  );

  const stats = hasOrganization && (
    <SidebarItem
      {...sidebarItemProps}
      icon={<IconStats />}
      label={t('Stats')}
      to={`/organizations/${organization.slug}/stats/`}
      id="stats"
    />
  );

  const settings = hasOrganization && (
    <SidebarItem
      {...sidebarItemProps}
      icon={<IconSettings />}
      label={t('Settings')}
      to={`/settings/${organization.slug}/`}
      id="settings"
    />
  );

  const insights = hasOrganization && (
    <Feature key="insights" features="insights-entry-points" organization={organization}>
      <SidebarAccordion
        {...sidebarItemProps}
        icon={<IconGraph />}
        label={<GuideAnchor target="insights">{t('Insights')}</GuideAnchor>}
        id="insights"
        initiallyExpanded={false}
        exact={!shouldAccordionFloat}
      >
        {requests}
        {queries}
        {resources}
        {appStarts}
        {screenLoads}
        {webVitals}
        {caches}
        {queues}
        {mobileUI}
        {mobileScreens}
        {llmMonitoring}
      </SidebarAccordion>
    </Feature>
  );

  // Sidebar accordion includes a secondary list of nav items
  // TODO: replace with a secondary panel
  const explore = (
    <SidebarAccordion
      {...sidebarItemProps}
      icon={<IconSearch />}
      label={<GuideAnchor target="explore">{t('Explore')}</GuideAnchor>}
      id="explore"
      exact={!shouldAccordionFloat}
    >
      {traces}
      {metrics}
      {profiling}
      {replays}
      {discover2}
    </SidebarAccordion>
  );

  return (
    <SidebarWrapper
      aria-label={t('Primary Navigation')}
      collapsed={collapsed}
      hasNewNav={hasNewNav}
    >
      <ExpandedContextProvider>
        <SidebarSectionGroupPrimary>
          <DropdownSidebarSection
            isSuperuser={showSuperuserWarning() && !isExcludedOrg()}
            hasNewNav={hasNewNav}
          >
            <SidebarDropdown
              orientation={orientation}
              collapsed={hasNewNav || collapsed}
            />

            {showSuperuserWarning() && !isExcludedOrg() && (
              <Hook name="component:superuser-warning" organization={organization} />
            )}
          </DropdownSidebarSection>

          <PrimaryItems>
            {hasOrganization && (
              <Fragment>
                <SidebarSection hasNewNav={hasNewNav}>
                  {issues}
                  {projects}
                </SidebarSection>

                {!isSelfHostedErrorsOnly && (
                  <Fragment>
                    <SidebarSection hasNewNav={hasNewNav}>
                      {explore}
                      {insights}
                    </SidebarSection>

                    <SidebarSection hasNewNav={hasNewNav}>
                      {performance}
                      {feedback}
                      {monitors}
                      {alerts}
                      {dashboards}
                      {releases}
                    </SidebarSection>
                  </Fragment>
                )}

                {isSelfHostedErrorsOnly && (
                  <Fragment>
                    <SidebarSection hasNewNav={hasNewNav}>
                      {alerts}
                      {discover2}
                      {dashboards}
                      {releases}
                      {userFeedback}
                    </SidebarSection>
                  </Fragment>
                )}

                <SidebarSection hasNewNav={hasNewNav}>
                  {stats}
                  {settings}
                </SidebarSection>
              </Fragment>
            )}
          </PrimaryItems>
        </SidebarSectionGroupPrimary>

        {hasOrganization && (
          <SidebarSectionGroup hasNewNav={hasNewNav}>
            {/* What are the onboarding sidebars? */}
            <PerformanceOnboardingSidebar
              currentPanel={activePanel}
              onShowPanel={() => togglePanel(SidebarPanelKey.PERFORMANCE_ONBOARDING)}
              hidePanel={() => hidePanel('performance-sidequest')}
              {...sidebarItemProps}
            />
            <FeedbackOnboardingSidebar
              currentPanel={activePanel}
              onShowPanel={() => togglePanel(SidebarPanelKey.FEEDBACK_ONBOARDING)}
              hidePanel={hidePanel}
              {...sidebarItemProps}
            />
            <ReplaysOnboardingSidebar
              currentPanel={activePanel}
              onShowPanel={() => togglePanel(SidebarPanelKey.REPLAYS_ONBOARDING)}
              hidePanel={hidePanel}
              {...sidebarItemProps}
            />
            <ProfilingOnboardingSidebar
              currentPanel={activePanel}
              onShowPanel={() => togglePanel(SidebarPanelKey.PROFILING_ONBOARDING)}
              hidePanel={hidePanel}
              {...sidebarItemProps}
            />
            <MetricsOnboardingSidebar
              currentPanel={activePanel}
              onShowPanel={() => togglePanel(SidebarPanelKey.METRICS_ONBOARDING)}
              hidePanel={hidePanel}
              {...sidebarItemProps}
            />
            <SidebarSection hasNewNav={hasNewNav} noMargin noPadding>
              <OnboardingStatus
                org={organization}
                currentPanel={activePanel}
                onShowPanel={() => togglePanel(SidebarPanelKey.ONBOARDING_WIZARD)}
                hidePanel={hidePanel}
                {...sidebarItemProps}
              />
            </SidebarSection>

            <SidebarSection hasNewNav={hasNewNav}>
              {HookStore.get('sidebar:bottom-items').length > 0 &&
                HookStore.get('sidebar:bottom-items')[0]({
                  orientation,
                  collapsed,
                  hasPanel,
                  organization,
                })}
              <SidebarHelp
                orientation={orientation}
                collapsed={collapsed}
                hidePanel={hidePanel}
                organization={organization}
              />
              <Broadcasts
                orientation={orientation}
                collapsed={collapsed}
                currentPanel={activePanel}
                onShowPanel={() => togglePanel(SidebarPanelKey.BROADCASTS)}
                hidePanel={hidePanel}
                organization={organization}
              />
              <ServiceIncidents
                orientation={orientation}
                collapsed={collapsed}
                currentPanel={activePanel}
                onShowPanel={() => togglePanel(SidebarPanelKey.SERVICE_INCIDENTS)}
                hidePanel={hidePanel}
              />
            </SidebarSection>

            {!horizontal && !hasNewNav && (
              <SidebarSection hasNewNav={hasNewNav}>
                <SidebarCollapseItem
                  id="collapse"
                  data-test-id="sidebar-collapse"
                  {...sidebarItemProps}
                  icon={<Chevron direction={collapsed ? 'right' : 'left'} />}
                  label={collapsed ? t('Expand') : t('Collapse')}
                  onClick={toggleCollapse}
                />
              </SidebarSection>
            )}
          </SidebarSectionGroup>
        )}
      </ExpandedContextProvider>
    </SidebarWrapper>
  );
}

export default Sidebar;

const responsiveFlex = css`
  display: flex;
  flex-direction: column;

  @media (max-width: ${theme.breakpoints.medium}) {
    flex-direction: row;
  }
`;

export const SidebarWrapper = styled('nav')<{collapsed: boolean; hasNewNav?: boolean}>`
  background: ${p => p.theme.sidebarGradient};
  color: ${p => p.theme.sidebar.color};
  line-height: 1;
  padding: 12px 0 2px; /* Allows for 32px avatars  */
  width: ${p =>
    p.theme.sidebar[
      p.hasNewNav
        ? 'semiCollapsedWidth'
        : p.collapsed
          ? 'collapsedWidth'
          : 'expandedWidth'
    ]};
  position: fixed;
  top: ${p => (ConfigStore.get('demoMode') ? p.theme.demo.headerSize : 0)};
  left: 0;
  bottom: 0;
  justify-content: space-between;
  z-index: ${p => p.theme.zIndex.sidebar};
  border-right: solid 1px ${p => p.theme.sidebarBorder};
  ${responsiveFlex};

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    top: 0;
    left: 0;
    right: 0;
    height: ${p => p.theme.sidebar.mobileHeight};
    bottom: auto;
    width: auto;
    padding: 0 ${space(1)};
    align-items: center;
    border-right: none;
    border-bottom: solid 1px ${p => p.theme.sidebarBorder};
  }
`;

const SidebarSectionGroup = styled('div')<{hasNewNav?: boolean}>`
  ${responsiveFlex};
  flex-shrink: 0; /* prevents shrinking on Safari */
  gap: 1px;
  ${p => p.hasNewNav && `align-items: center;`}
`;

const SidebarSectionGroupPrimary = styled('div')`
  ${responsiveFlex};
  /* necessary for child flexing on msedge and ff */
  min-height: 0;
  min-width: 0;
  flex: 1;
  /* expand to fill the entire height on mobile */
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    height: 100%;
    align-items: center;
  }
`;

const PrimaryItems = styled('div')`
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  -ms-overflow-style: -ms-autohiding-scrollbar;

  scrollbar-color: ${p => p.theme.sidebar.scrollbarThumbColor}
    ${p => p.theme.sidebar.scrollbarColorTrack};
  scrollbar-width: ${p => p.theme.sidebar.scrollbarWidth};

  @media (max-height: 675px) and (min-width: ${p => p.theme.breakpoints.medium}) {
    border-bottom: 1px solid ${p => p.theme.sidebarBorder};
    padding-bottom: ${space(1)};
    box-shadow: rgba(0, 0, 0, 0.15) 0px -10px 10px inset;
  }
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    overflow-y: hidden;
    overflow-x: auto;
    flex-direction: row;
    height: 100%;
    align-items: center;
    border-right: 1px solid ${p => p.theme.sidebarBorder};
    padding-right: ${space(1)};
    margin-right: ${space(0.5)};
    box-shadow: rgba(0, 0, 0, 0.15) -10px 0px 10px inset;
    ::-webkit-scrollbar {
      display: none;
    }
  }
`;

const SubitemDot = styled('div')<{collapsed: boolean}>`
  width: 3px;
  height: 3px;
  background: currentcolor;
  border-radius: 50%;

  opacity: ${p => (p.collapsed ? 1 : 0)};
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    opacity: 1;
  }
`;

const SidebarSection = styled(SidebarSectionGroup)<{
  hasNewNav?: boolean;
  noMargin?: boolean;
  noPadding?: boolean;
}>`
  ${p => !p.noMargin && !p.hasNewNav && `margin: ${space(1)} 0`};
  ${p => !p.noPadding && !p.hasNewNav && `padding: 0 ${space(2)}`};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    margin: 0;
    padding: 0;
  }
  ${p =>
    p.hasNewNav &&
    css`
      @media (max-width: ${p.theme.breakpoints.medium}) {
        margin: 0;
        padding: 0;
      }
    `}

  &:empty {
    display: none;
  }
`;

const DropdownSidebarSection = styled(SidebarSection)<{
  hasNewNav?: boolean;
  isSuperuser?: boolean;
}>`
  position: relative;
  margin: 0;
  padding: ${space(1)} ${space(2)};

  ${p =>
    p.isSuperuser &&
    css`
      &:before {
        content: '';
        position: absolute;
        inset: 0 ${space(1)};
        border-radius: ${p.theme.borderRadius};
        background: ${p.theme.superuserSidebar};
      }
    `}
  ${p => p.hasNewNav && `align-items: center;`}
`;

const SidebarCollapseItem = styled(SidebarItem)`
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    display: none;
  }
`;
