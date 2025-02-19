import {Fragment, useCallback, useContext, useEffect} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {hideSidebar, showSidebar} from 'sentry/actionCreators/preferences';
import Feature from 'sentry/components/acl/feature';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {Chevron} from 'sentry/components/chevron';
import FeatureFlagOnboardingSidebar from 'sentry/components/events/featureFlags/featureFlagOnboardingSidebar';
import FeedbackOnboardingSidebar from 'sentry/components/feedback/feedbackOnboarding/sidebar';
import Hook from 'sentry/components/hook';
import PerformanceOnboardingSidebar from 'sentry/components/performanceOnboarding/sidebar';
import ReplaysOnboardingSidebar from 'sentry/components/replaysOnboarding/sidebar';
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  SIDEBAR_MOBILE_HEIGHT,
  SIDEBAR_SEMI_COLLAPSED_WIDTH,
} from 'sentry/components/sidebar/constants';
import {
  ExpandedContext,
  ExpandedContextProvider,
} from 'sentry/components/sidebar/expandedContextProvider';
import {OnboardingStatus} from 'sentry/components/sidebar/onboardingStatus';
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
  IconTelescope,
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
import {isDemoModeEnabled} from 'sentry/utils/demoMode';
import {getDiscoverLandingUrl} from 'sentry/utils/discover/urls';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import theme from 'sentry/utils/theme';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {MODULE_BASE_URLS} from 'sentry/views/insights/common/utils/useModuleURL';
import {
  AI_LANDING_SUB_PATH,
  AI_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/ai/settings';
import {
  BACKEND_LANDING_SUB_PATH,
  BACKEND_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/backend/settings';
import {
  FRONTEND_LANDING_SUB_PATH,
  FRONTEND_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/frontend/settings';
import {
  MOBILE_LANDING_SUB_PATH,
  MOBILE_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/mobile/settings';
import {
  DOMAIN_VIEW_BASE_TITLE,
  DOMAIN_VIEW_BASE_URL,
} from 'sentry/views/insights/pages/settings';
import {
  getPerformanceBaseUrl,
  platformToDomainView,
} from 'sentry/views/performance/utils';

import {LegacyProfilingOnboardingSidebar} from '../profiling/profilingOnboardingSidebar';

import {Broadcasts} from './broadcasts';
import SidebarHelp from './help';
import ServiceIncidents from './serviceIncidents';
import {SidebarAccordion} from './sidebarAccordion';
import SidebarDropdown from './sidebarDropdown';
import SidebarItem from './sidebarItem';
import type {SidebarOrientation} from './types';
import {SidebarPanelKey} from './types';

function togglePanel(panel: SidebarPanelKey) {
  SidebarPanelStore.togglePanel(panel);
}

function hidePanel(hash?: string) {
  SidebarPanelStore.hidePanel(hash);
}

function Sidebar() {
  const location = useLocation();
  const preferences = useLegacyStore(PreferencesStore);
  const activePanel = useLegacyStore(SidebarPanelStore);
  const organization = useOrganization({allowNull: true});
  const {shouldAccordionFloat} = useContext(ExpandedContext);
  const {selection} = usePageFilters();
  const {projects: projectList} = useProjects();
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

  const sidebarAnchor = isDemoModeEnabled() ? (
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

  const discover = hasOrganization && (
    <Feature
      hookName="feature-disabled:discover2-sidebar-item"
      features="discover-basic"
      organization={organization}
    >
      <SidebarItem
        {...sidebarItemProps}
        // In errors-only deploys, Discover isn't a nested link, so it needs a proper icon
        icon={isSelfHostedErrorsOnly ? <IconTelescope /> : <SubitemDot collapsed />}
        label={<GuideAnchor target="discover">{t('Discover')}</GuideAnchor>}
        to={getDiscoverLandingUrl(organization)}
        id="discover-v2"
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
      />
    </Feature>
  );

  const logs = hasOrganization && (
    <Feature features="ourlogs-enabled">
      <SidebarItem
        {...sidebarItemProps}
        label={<GuideAnchor target="logs">{t('Logs')}</GuideAnchor>}
        to={`/organizations/${organization?.slug}/explore/logs/`}
        id="ourlogs"
        icon={<SubitemDot collapsed />}
      />
    </Feature>
  );

  const hasPerfLandingRemovalFlag = organization?.features.includes(
    'insights-performance-landing-removal'
  );
  const view = hasPerfLandingRemovalFlag
    ? platformToDomainView(projectList, selection.projects)
    : undefined;
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
        active={hasPerfLandingRemovalFlag ? false : undefined}
        to={`${getPerformanceBaseUrl(organization.slug, view)}/`}
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
      to={makeAlertsPathname({
        path: '/rules/',
        organization,
      })}
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

  const performanceDomains = hasOrganization && (
    <Feature features={['performance-view']} organization={organization}>
      <SidebarAccordion
        {...sidebarItemProps}
        icon={<IconGraph />}
        label={DOMAIN_VIEW_BASE_TITLE}
        id="insights-domains"
        initiallyExpanded
        active={
          hasPerfLandingRemovalFlag
            ? location.pathname.includes(`/${DOMAIN_VIEW_BASE_URL}/summary`)
            : undefined
        }
        exact={!shouldAccordionFloat}
      >
        <SidebarItem
          {...sidebarItemProps}
          label={FRONTEND_SIDEBAR_LABEL}
          to={`/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}/${FRONTEND_LANDING_SUB_PATH}/`}
          id="performance-domains-web"
          icon={<SubitemDot collapsed />}
        />
        <SidebarItem
          {...sidebarItemProps}
          label={BACKEND_SIDEBAR_LABEL}
          to={`/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}/${BACKEND_LANDING_SUB_PATH}/`}
          id="performance-domains-platform"
          icon={<SubitemDot collapsed />}
        />
        <SidebarItem
          {...sidebarItemProps}
          label={MOBILE_SIDEBAR_LABEL}
          to={`/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}/${MOBILE_LANDING_SUB_PATH}/`}
          id="performance-domains-mobile"
          icon={<SubitemDot collapsed />}
        />
        <SidebarItem
          {...sidebarItemProps}
          label={AI_SIDEBAR_LABEL}
          to={`/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}/${AI_LANDING_SUB_PATH}/${MODULE_BASE_URLS[AI_LANDING_SUB_PATH]}/`}
          id="performance-domains-ai"
          icon={<SubitemDot collapsed />}
        />
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
      {logs}
      {profiling}
      {replays}
      {discover}
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
                      {performanceDomains}
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
                      {discover}
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
            <FeatureFlagOnboardingSidebar
              currentPanel={activePanel}
              onShowPanel={() => togglePanel(SidebarPanelKey.FEATURE_FLAG_ONBOARDING)}
              hidePanel={hidePanel}
              {...sidebarItemProps}
            />
            <LegacyProfilingOnboardingSidebar
              currentPanel={activePanel}
              onShowPanel={() => togglePanel(SidebarPanelKey.PROFILING_ONBOARDING)}
              hidePanel={hidePanel}
              {...sidebarItemProps}
            />

            <SidebarSection hasNewNav={hasNewNav} noMargin noPadding>
              <OnboardingStatus
                currentPanel={activePanel}
                onShowPanel={() => togglePanel(SidebarPanelKey.ONBOARDING_WIZARD)}
                hidePanel={hidePanel}
                {...sidebarItemProps}
              />
            </SidebarSection>

            <SidebarSection hasNewNav={hasNewNav} centeredItems={horizontal}>
              {HookStore.get('sidebar:bottom-items').length > 0 &&
                HookStore.get('sidebar:bottom-items')[0]!({
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
  background: ${p => p.theme.sidebar.gradient};
  /* @TODO(jonasbadalic): This was a one off color defined in the theme */
  color: #9586a5;
  line-height: 1;
  padding: 12px 0 2px; /* Allows for 32px avatars  */
  width: ${p =>
    p.hasNewNav
      ? SIDEBAR_SEMI_COLLAPSED_WIDTH
      : p.collapsed
        ? SIDEBAR_COLLAPSED_WIDTH
        : SIDEBAR_EXPANDED_WIDTH};
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  justify-content: space-between;
  z-index: ${p => p.theme.zIndex.sidebar};
  border-right: solid 1px ${p => p.theme.sidebar.border};
  ${responsiveFlex};

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    top: 0;
    left: 0;
    right: 0;
    height: ${SIDEBAR_MOBILE_HEIGHT};
    bottom: auto;
    width: auto;
    padding: 0 ${space(1)};
    align-items: center;
    border-right: none;
    border-bottom: solid 1px ${p => p.theme.sidebar.border};
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

  scrollbar-color: ${p =>
    `${p.theme.sidebar.scrollbarThumbColor} ${p.theme.sidebar.scrollbarColorTrack}`};
  scrollbar-width: thin;

  @media (max-height: 675px) and (min-width: ${p => p.theme.breakpoints.medium}) {
    border-bottom: 1px solid ${p => p.theme.sidebar.border};
    padding-bottom: ${space(1)};
    box-shadow: rgba(0, 0, 0, 0.15) 0px -10px 10px inset;
  }
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    overflow-y: hidden;
    overflow-x: auto;
    flex-direction: row;
    height: 100%;
    align-items: center;
    border-right: 1px solid ${p => p.theme.sidebar.border};
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
  centeredItems?: boolean;
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

  ${p =>
    p.centeredItems &&
    css`
      align-items: center;
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
        background: ${p.theme.sidebar.superuser};
      }
    `}
  ${p => p.hasNewNav && `align-items: center;`}
`;

const SidebarCollapseItem = styled(SidebarItem)`
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    display: none;
  }
`;
