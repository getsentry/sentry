import {Fragment, useCallback, useContext, useEffect} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {hideSidebar, showSidebar} from 'sentry/actionCreators/preferences';
import Feature from 'sentry/components/acl/feature';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {OnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {getMergedTasks} from 'sentry/components/onboardingWizard/taskConfig';
import PerformanceOnboardingSidebar from 'sentry/components/performanceOnboarding/sidebar';
import ReplaysOnboardingSidebar from 'sentry/components/replaysOnboarding/sidebar';
import {isDone} from 'sentry/components/sidebar/utils';
import {
  IconChevron,
  IconDashboard,
  IconGraph,
  IconIssues,
  IconLightning,
  IconMegaphone,
  IconPlay,
  IconProfiling,
  IconProject,
  IconReleases,
  IconSettings,
  IconSiren,
  IconStar,
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
import {Organization} from 'sentry/types';
import {isDemoWalkthrough} from 'sentry/utils/demoMode';
import {getDiscoverLandingUrl} from 'sentry/utils/discover/urls';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import theme from 'sentry/utils/theme';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import MetricsOnboardingSidebar from 'sentry/views/ddm/ddmOnboarding/sidebar';
import {RELEASE_LEVEL as WEBVITALS_RELEASE_LEVEL} from 'sentry/views/performance/browser/webVitals/settings';
import {SCREENS_RELEASE_LEVEL} from 'sentry/views/performance/mobile/settings';

import {ProfilingOnboardingSidebar} from '../profiling/ProfilingOnboarding/profilingOnboardingSidebar';

import Broadcasts from './broadcasts';
import SidebarHelp from './help';
import OnboardingStatus from './onboardingStatus';
import ServiceIncidents from './serviceIncidents';
import {SidebarAccordion} from './sidebarAccordion';
import SidebarDropdown from './sidebarDropdown';
import SidebarItem from './sidebarItem';
import {SidebarOrientation, SidebarPanelKey} from './types';

type Props = {
  organization?: Organization;
};

function activatePanel(panel: SidebarPanelKey) {
  SidebarPanelStore.activatePanel(panel);
}

function togglePanel(panel: SidebarPanelKey) {
  SidebarPanelStore.togglePanel(panel);
}

function hidePanel() {
  SidebarPanelStore.hidePanel();
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

function Sidebar({organization}: Props) {
  const location = useLocation();
  const config = useLegacyStore(ConfigStore);
  const preferences = useLegacyStore(PreferencesStore);
  const activePanel = useLegacyStore(SidebarPanelStore);

  const collapsed = !!preferences.collapsed;
  const horizontal = useMedia(`(max-width: ${theme.breakpoints.medium})`);
  const hasSuperuserSession = isActiveSuperuser();

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

  const hasPanel = !!activePanel;
  const hasOrganization = !!organization;
  const orientation: SidebarOrientation = horizontal ? 'top' : 'left';

  const sidebarItemProps = {
    orientation,
    collapsed,
    hasPanel,
    organization,
  };

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
        icon={<IconTelescope />}
        label={<GuideAnchor target="discover">{t('Discover')}</GuideAnchor>}
        to={getDiscoverLandingUrl(organization)}
        id="discover-v2"
      />
    </Feature>
  );

  const performance = hasOrganization && (
    <Feature
      hookName="feature-disabled:performance-sidebar-item"
      features="performance-view"
      organization={organization}
    >
      {(() => {
        // If Database View or Web Vitals View is enabled, show a Performance accordion with a Database and/or Web Vitals sub-item
        if (
          organization.features.includes('performance-database-view') ||
          organization.features.includes('starfish-browser-webvitals') ||
          organization.features.includes('performance-screens-view')
        ) {
          return (
            <SidebarAccordion
              {...sidebarItemProps}
              icon={<IconLightning />}
              label={<GuideAnchor target="performance">{t('Performance')}</GuideAnchor>}
              to={`/organizations/${organization.slug}/performance/`}
              id="performance"
            >
              <Feature features="performance-database-view" organization={organization}>
                <SidebarItem
                  {...sidebarItemProps}
                  label={
                    <GuideAnchor target="performance-database">
                      {t('Queries')}
                    </GuideAnchor>
                  }
                  to={`/organizations/${organization.slug}/performance/database/`}
                  id="performance-database"
                  // collapsed controls whether the dot is visible or not.
                  // We always want it visible for these sidebar items so force it to true.
                  icon={<SubitemDot collapsed />}
                />
              </Feature>
              <Feature features="starfish-browser-webvitals" organization={organization}>
                <SidebarItem
                  {...sidebarItemProps}
                  isAlpha={WEBVITALS_RELEASE_LEVEL === 'alpha'}
                  isBeta={WEBVITALS_RELEASE_LEVEL === 'beta'}
                  isNew={WEBVITALS_RELEASE_LEVEL === 'new'}
                  label={
                    <GuideAnchor target="performance-webvitals">
                      {t('Web Vitals')}
                    </GuideAnchor>
                  }
                  to={`/organizations/${organization.slug}/performance/browser/pageloads/`}
                  id="performance-webvitals"
                  icon={<SubitemDot collapsed />}
                />
              </Feature>
              <Feature features="performance-screens-view" organization={organization}>
                <SidebarItem
                  {...sidebarItemProps}
                  isAlpha={SCREENS_RELEASE_LEVEL === 'alpha'}
                  isBeta={SCREENS_RELEASE_LEVEL === 'beta'}
                  isNew={SCREENS_RELEASE_LEVEL === 'new'}
                  label={t('Mobile')}
                  to={`/organizations/${organization.slug}/performance/mobile/screens/`}
                  id="performance-mobile-screens"
                  icon={<SubitemDot collapsed />}
                />
              </Feature>
              <Feature features="starfish-browser-resource-module-ui">
                <SidebarItem
                  {...sidebarItemProps}
                  isNew
                  label={<GuideAnchor target="starfish">{t('Resources')}</GuideAnchor>}
                  to={`/organizations/${organization.slug}/performance/browser/resources`}
                  id="performance-browser-resources"
                  icon={<SubitemDot collapsed />}
                />
              </Feature>
            </SidebarAccordion>
          );
        }

        // Otherwise, show a regular sidebar link to the Performance landing page
        return (
          <SidebarItem
            {...sidebarItemProps}
            icon={<IconLightning />}
            label={<GuideAnchor target="performance">{t('Performance')}</GuideAnchor>}
            to={`/organizations/${organization.slug}/performance/`}
            id="performance"
          />
        );
      })()}
    </Feature>
  );

  const starfish = hasOrganization && (
    <Feature
      hookName="feature-disabled:starfish-view"
      features="starfish-view"
      organization={organization}
    >
      <SidebarAccordion
        {...sidebarItemProps}
        icon={<IconStar />}
        aria-label={t('Starfish')}
        label={<GuideAnchor target="starfish">{t('Starfish')}</GuideAnchor>}
        to={`/organizations/${organization.slug}/starfish/`}
        id="starfish"
        exact
      >
        <SidebarItem
          {...sidebarItemProps}
          label={<GuideAnchor target="starfish">{t('Database')}</GuideAnchor>}
          to={`/organizations/${organization.slug}/performance/database/`}
          id="performance-database"
          icon={<SubitemDot collapsed={collapsed} />}
        />
        <SidebarItem
          {...sidebarItemProps}
          label={<GuideAnchor target="starfish">{t('Interactions')}</GuideAnchor>}
          to={`/organizations/${organization.slug}/performance/browser/interactions`}
          id="performance-browser-interactions"
          icon={<SubitemDot collapsed={collapsed} />}
        />
        <SidebarItem
          {...sidebarItemProps}
          label={<GuideAnchor target="starfish">{t('App Startup')}</GuideAnchor>}
          to={`/organizations/${organization.slug}/starfish/appStartup`}
          id="performance-mobile-app-startup"
          icon={<SubitemDot collapsed={collapsed} />}
        />
      </SidebarAccordion>
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
        isBeta
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
    <Feature features="monitors" organization={organization}>
      <SidebarItem
        {...sidebarItemProps}
        icon={<IconTimer />}
        label={t('Crons')}
        to={`/organizations/${organization.slug}/crons/`}
        id="crons"
        isBeta
      />
    </Feature>
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
        icon={<IconPlay />}
        label={t('Replays')}
        to={`/organizations/${organization.slug}/replays/`}
        id="replays"
      />
    </Feature>
  );

  const ddmPath = `/organizations/${organization?.slug}/ddm/`;
  const ddm = hasOrganization && (
    <Feature
      features={['ddm-ui', 'custom-metrics']}
      organization={organization}
      requireAll
    >
      <SidebarItem
        {...sidebarItemProps}
        icon={<IconGraph />}
        label={t('Metrics')}
        to={ddmPath}
        search={location.pathname === normalizeUrl(ddmPath) ? location.search : ''}
        id="ddm"
        isAlpha
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
        icon={<IconProfiling />}
        label={t('Profiling')}
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

  return (
    <SidebarWrapper aria-label={t('Primary Navigation')} collapsed={collapsed}>
      <SidebarSectionGroupPrimary>
        <DropdownSidebarSection isSuperuser={hasSuperuserSession}>
          <SidebarDropdown
            orientation={orientation}
            collapsed={collapsed}
            org={organization}
            user={config.user}
            config={config}
          />
        </DropdownSidebarSection>

        <PrimaryItems>
          {hasOrganization && (
            <Fragment>
              <SidebarSection>
                {issues}
                {projects}
              </SidebarSection>

              <SidebarSection>
                {performance}
                {starfish}
                {profiling}
                {ddm}
                {replays}
                {feedback}
                {monitors}
                {alerts}
              </SidebarSection>

              <SidebarSection>
                {discover2}
                {dashboards}
                {releases}
                {userFeedback}
              </SidebarSection>

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
          <PerformanceOnboardingSidebar
            currentPanel={activePanel}
            onShowPanel={() => togglePanel(SidebarPanelKey.PERFORMANCE_ONBOARDING)}
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
          <SidebarSection noMargin noPadding>
            <OnboardingStatus
              org={organization}
              currentPanel={activePanel}
              onShowPanel={() => togglePanel(SidebarPanelKey.ONBOARDING_WIZARD)}
              hidePanel={hidePanel}
              {...sidebarItemProps}
            />
          </SidebarSection>

          <SidebarSection>
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

          {!horizontal && (
            <SidebarSection>
              <SidebarCollapseItem
                id="collapse"
                data-test-id="sidebar-collapse"
                {...sidebarItemProps}
                icon={<IconChevron direction={collapsed ? 'right' : 'left'} size="sm" />}
                label={collapsed ? t('Expand') : t('Collapse')}
                onClick={toggleCollapse}
              />
            </SidebarSection>
          )}
        </SidebarSectionGroup>
      )}
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

export const SidebarWrapper = styled('nav')<{collapsed: boolean}>`
  background: ${p => p.theme.sidebarGradient};
  color: ${p => p.theme.sidebar.color};
  line-height: 1;
  padding: 12px 0 2px; /* Allows for 32px avatars  */
  width: ${p => p.theme.sidebar[p.collapsed ? 'collapsedWidth' : 'expandedWidth']};
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

const SidebarSectionGroup = styled('div')`
  ${responsiveFlex};
  flex-shrink: 0; /* prevents shrinking on Safari */
  gap: 1px;
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
  overflow: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  -ms-overflow-style: -ms-autohiding-scrollbar;
  @media (max-height: 675px) and (min-width: ${p => p.theme.breakpoints.medium}) {
    border-bottom: 1px solid ${p => p.theme.gray400};
    padding-bottom: ${space(1)};
    box-shadow: rgba(0, 0, 0, 0.15) 0px -10px 10px inset;
  }
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    overflow-y: visible;
    flex-direction: row;
    height: 100%;
    align-items: center;
    border-right: 1px solid ${p => p.theme.gray400};
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
  noMargin?: boolean;
  noPadding?: boolean;
}>`
  ${p => !p.noMargin && `margin: ${space(1)} 0`};
  ${p => !p.noPadding && `padding: 0 ${space(2)}`};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    margin: 0;
    padding: 0;
  }

  &:empty {
    display: none;
  }
`;

const DropdownSidebarSection = styled(SidebarSection)<{
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
`;

const SidebarCollapseItem = styled(SidebarItem)`
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    display: none;
  }
`;
