import {Fragment, useCallback, useContext, useEffect} from 'react';
import {css, type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {hideSidebar, showSidebar} from 'sentry/actionCreators/preferences';
import Feature from 'sentry/components/acl/feature';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import FeatureFlagOnboardingSidebar from 'sentry/components/events/featureFlags/onboarding/featureFlagOnboardingSidebar';
import FeedbackOnboardingSidebar from 'sentry/components/feedback/feedbackOnboarding/sidebar';
import Hook from 'sentry/components/hook';
import PerformanceOnboardingSidebar from 'sentry/components/performanceOnboarding/sidebar';
import {LegacyProfilingOnboardingSidebar} from 'sentry/components/profiling/profilingOnboardingSidebar';
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
  IconChevron,
  IconDashboard,
  IconGraph,
  IconIssues,
  IconMegaphone,
  IconProject,
  IconReleases,
  IconSearch,
  IconSettings,
  IconSiren,
  IconStats,
  IconTelescope,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import DemoWalkthroughStore from 'sentry/stores/demoWalkthroughStore';
import HookStore from 'sentry/stores/hookStore';
import PreferencesStore from 'sentry/stores/preferencesStore';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {getDiscoverLandingUrl} from 'sentry/utils/discover/urls';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {ChonkOptInBanner} from 'sentry/utils/theme/ChonkOptInBanner';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {AIInsightsFeature} from 'sentry/views/insights/agentMonitoring/utils/features';
import {MODULE_BASE_URLS} from 'sentry/views/insights/common/utils/useModuleURL';
import {
  AGENTS_LANDING_SUB_PATH,
  AGENTS_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/agents/settings';
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
import {OptInBanner} from 'sentry/views/nav/optInBanner';

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
  const theme = useTheme();
  const location = useLocation();
  const preferences = useLegacyStore(PreferencesStore);
  const activePanel = useLegacyStore(SidebarPanelStore);
  const organization = useOrganization({allowNull: true});
  const {shouldAccordionFloat} = useContext(ExpandedContext);
  const hasOrganization = !!organization;
  const isSelfHostedErrorsOnly = ConfigStore.get('isSelfHostedErrorsOnly');

  const collapsed = !!preferences.collapsed;
  const horizontal = useMedia(`(max-width: ${theme.breakpoints.md})`);
  // Panel determines whether to highlight
  const hasPanel = !!activePanel;
  const orientation: SidebarOrientation = horizontal ? 'top' : 'left';

  const sidebarItemProps = {orientation, collapsed, hasPanel, organization};
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

  const sidebarAnchor = isDemoModeActive() ? (
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
    <Feature features={['performance-trace-explorer', 'performance-view']}>
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
        isNew
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

  const feedback = hasOrganization && (
    <Feature features="user-feedback-ui" organization={organization}>
      <SidebarItem
        {...sidebarItemProps}
        icon={<IconMegaphone />}
        label={t('User Feedback')}
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
      to={makeAlertsPathname({path: '/rules/', organization})}
      id="alerts"
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
        label={t('Dashboards')}
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
        active={location.pathname.includes(`/${DOMAIN_VIEW_BASE_URL}/summary`)}
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
        <AIInsightsFeature
          organization={organization}
          renderDisabled={() => (
            <SidebarItem
              {...sidebarItemProps}
              label={AI_SIDEBAR_LABEL}
              to={`/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}/${AI_LANDING_SUB_PATH}/${MODULE_BASE_URLS[AI_LANDING_SUB_PATH]}/`}
              id="performance-domains-ai"
              icon={<SubitemDot collapsed />}
            />
          )}
        >
          <SidebarItem
            {...sidebarItemProps}
            label={AGENTS_SIDEBAR_LABEL}
            to={`/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}/${AGENTS_LANDING_SUB_PATH}/${MODULE_BASE_URLS[AGENTS_LANDING_SUB_PATH]}/`}
            id="performance-domains-agents"
            icon={<SubitemDot collapsed />}
            isBeta
          />
        </AIInsightsFeature>
        <SidebarItem
          {...sidebarItemProps}
          label={t('Crons')}
          to={`/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}/crons/`}
          id="performance-crons"
          icon={<SubitemDot collapsed />}
        />
        <Feature features={['uptime']} organization={organization}>
          <SidebarItem
            {...sidebarItemProps}
            label={t('Uptime')}
            to={`/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}/uptime/`}
            id="performance-uptime"
            icon={<SubitemDot collapsed />}
          />
        </Feature>
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
    <SidebarWrapper aria-label={t('Primary Navigation')} collapsed={collapsed}>
      <ExpandedContextProvider>
        <SidebarSectionGroupPrimary>
          <DropdownSidebarSection
            isSuperuser={showSuperuserWarning() && !isExcludedOrg()}
          >
            <SidebarDropdown orientation={orientation} collapsed={collapsed} />

            {showSuperuserWarning() && !isExcludedOrg() && (
              <SuperuserBadgeContainer>
                <Hook name="component:superuser-warning" organization={organization} />
              </SuperuserBadgeContainer>
            )}
          </DropdownSidebarSection>
          <PrimaryItems>
            {hasOrganization && (
              <Fragment>
                <SidebarSection>
                  {issues}
                  {projects}
                </SidebarSection>

                {!isSelfHostedErrorsOnly && (
                  <Fragment>
                    <SidebarSection>
                      {explore}
                      {performanceDomains}
                    </SidebarSection>

                    <SidebarSection>
                      {feedback}
                      {alerts}
                      {dashboards}
                      {releases}
                    </SidebarSection>
                  </Fragment>
                )}

                {isSelfHostedErrorsOnly && (
                  <Fragment>
                    <SidebarSection>
                      {alerts}
                      {discover}
                      {dashboards}
                      {releases}
                    </SidebarSection>
                  </Fragment>
                )}

                <SidebarSection>
                  {stats}
                  {settings}
                </SidebarSection>
              </Fragment>
            )}
          </PrimaryItems>
        </SidebarSectionGroupPrimary>

        {hasOrganization && (
          <SidebarSectionGroup>
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

            <SidebarSection noMargin noPadding>
              <OnboardingStatus
                currentPanel={activePanel}
                onShowPanel={() => togglePanel(SidebarPanelKey.ONBOARDING_WIZARD)}
                hidePanel={hidePanel}
                {...sidebarItemProps}
              />
            </SidebarSection>

            <SidebarSection centeredItems={horizontal}>
              <OptInBanner
                collapsed={collapsed || horizontal}
                organization={organization}
              />
              <ChonkOptInBanner collapsed={collapsed || horizontal} />

              {HookStore.get('sidebar:try-business').length > 0 &&
                HookStore.get('sidebar:try-business')[0]!({
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
              {!isDemoModeActive() && (
                <Fragment>
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
                </Fragment>
              )}
            </SidebarSection>

            {!horizontal && (
              <SidebarSection>
                <SidebarCollapseItem
                  id="collapse"
                  data-test-id="sidebar-collapse"
                  {...sidebarItemProps}
                  icon={
                    <IconChevron direction={collapsed ? 'right' : 'left'} size="sm" />
                  }
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

const responsiveFlex = (theme: Theme) => css`
  display: flex;
  flex-direction: column;

  @media (max-width: ${theme.breakpoints.md}) {
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
  ${p => responsiveFlex(p.theme)};

  @media (max-width: ${p => p.theme.breakpoints.md}) {
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
  ${p => responsiveFlex(p.theme)};
  flex-shrink: 0; /* prevents shrinking on Safari */
  gap: 1px;
  ${p => p.hasNewNav && `align-items: center;`}
`;

const SidebarSectionGroupPrimary = styled('div')`
  ${p => responsiveFlex(p.theme)};
  /* necessary for child flexing on msedge and ff */
  min-height: 0;
  min-width: 0;
  flex: 1;
  /* expand to fill the entire height on mobile */
  @media (max-width: ${p => p.theme.breakpoints.md}) {
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

  @media (max-height: 675px) and (min-width: ${p => p.theme.breakpoints.md}) {
    border-bottom: 1px solid ${p => p.theme.sidebar.border};
    padding-bottom: ${space(1)};
    box-shadow: ${p =>
      p.theme.isChonk ? 'none' : 'rgba(0, 0, 0, 0.15) 0px -10px 10px inset'};
  }
  @media (max-width: ${p => p.theme.breakpoints.md}) {
    overflow-y: hidden;
    overflow-x: auto;
    flex-direction: row;
    height: 100%;
    align-items: center;
    padding-right: ${space(1)};
    margin-right: ${space(0.5)};
    border-right: none;
    box-shadow: ${p =>
      p.theme.isChonk ? 'none' : 'rgba(0, 0, 0, 0.15) -10px 0px 10px inset'};
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
  @media (max-width: ${p => p.theme.breakpoints.md}) {
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

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    margin: 0;
    padding: 0;
  }
  ${p =>
    p.hasNewNav &&
    css`
      @media (max-width: ${p.theme.breakpoints.md}) {
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
  @media (max-width: ${p => p.theme.breakpoints.md}) {
    display: none;
  }
`;

const SuperuserBadgeContainer = styled('div')`
  position: absolute;
  top: -5px;
  right: 5px;

  /* Hiding on smaller screens because it looks misplaced */
  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: none;
  }
`;
