import {Fragment, useContext, useEffect} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

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
  IconFile,
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
import theme from 'sentry/utils/theme';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useProjects from 'sentry/utils/useProjects';
import {RELEASE_LEVEL} from 'sentry/views/performance/database/settings';

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
  location?: Location;
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

function Sidebar({location, organization}: Props) {
  const config = useLegacyStore(ConfigStore);
  const preferences = useLegacyStore(PreferencesStore);
  const activePanel = useLegacyStore(SidebarPanelStore);

  const collapsed = !!preferences.collapsed;
  const horizontal = useMedia(`(max-width: ${theme.breakpoints.medium})`);

  useOpenOnboardingSidebar();

  const toggleCollapse = () => {
    const action = collapsed ? showSidebar : hideSidebar;
    action();
  };

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
      to={`/organizations/${organization.slug}/issues/?referrer=sidebar`}
      id="issues"
    />
  );

  const discover2 = hasOrganization && (
    <Feature
      hookName="feature-disabled:discover2-sidebar-item"
      features={['discover-basic']}
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
      features={['performance-view']}
      organization={organization}
    >
      {(() => {
        // If Database View is enabled, show a Performance accordion with a Database sub-item
        if (organization.features.includes('performance-database-view')) {
          return (
            <SidebarAccordion
              {...sidebarItemProps}
              icon={<IconLightning />}
              label={<GuideAnchor target="performance">{t('Performance')}</GuideAnchor>}
              to={`/organizations/${organization.slug}/performance/`}
              id="performance"
            >
              <SidebarItem
                {...sidebarItemProps}
                isAlpha={RELEASE_LEVEL === 'alpha'}
                isBeta={RELEASE_LEVEL === 'beta'}
                isNew={RELEASE_LEVEL === 'new'}
                label={
                  <GuideAnchor target="performance-database">{t('Queries')}</GuideAnchor>
                }
                to={`/organizations/${organization.slug}/performance/database/`}
                id="performance-database"
                icon={<SubitemDot collapsed={collapsed} />}
              />
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
      features={['starfish-view']}
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
          label={<GuideAnchor target="starfish">{t('Resources')}</GuideAnchor>}
          to={`/organizations/${organization.slug}/performance/browser/resources`}
          id="performance-browser-resources"
          icon={<IconFile />}
        />
        <SidebarItem
          {...sidebarItemProps}
          label={<GuideAnchor target="starfish">{t('Page Loads')}</GuideAnchor>}
          to={`/organizations/${organization.slug}/performance/browser/pageloads`}
          id="performance-browser-page-loads"
          icon={<SubitemDot collapsed={collapsed} />}
        />
        <SidebarItem
          {...sidebarItemProps}
          label={<GuideAnchor target="starfish">{t('Screen Load')}</GuideAnchor>}
          to={`/organizations/${organization.slug}/starfish/pageload/`}
          id="starfish-mobile-screen-loads"
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
    <SidebarItem
      {...sidebarItemProps}
      icon={<IconSupport />}
      label={t('User Feedback')}
      to={`/organizations/${organization.slug}/user-feedback/`}
      id="user-feedback"
    />
  );

  const feedback = hasOrganization && (
    <Feature features={['user-feedback-ui']} organization={organization}>
      <SidebarItem
        {...sidebarItemProps}
        icon={<IconMegaphone />}
        label={t('Bug Reports')}
        to={`/organizations/${organization.slug}/feedback/`}
        id="feedback"
        isAlpha
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
    <Feature features={['monitors']} organization={organization}>
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
      features={['session-replay-ui']}
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

  const ddm = hasOrganization && (
    <Feature
      features={['ddm-ui', 'custom-metrics']}
      organization={organization}
      requireAll
    >
      <SidebarItem
        {...sidebarItemProps}
        icon={<IconGraph />}
        label={t('DDM')}
        to={`/organizations/${organization.slug}/ddm/`}
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
      features={['profiling']}
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
        <SidebarSection>
          <SidebarDropdown
            orientation={orientation}
            collapsed={collapsed}
            org={organization}
            user={config.user}
            config={config}
          />
        </SidebarSection>

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
                {monitors}
                {alerts}
              </SidebarSection>

              <SidebarSection>
                {discover2}
                {dashboards}
                {releases}
                {userFeedback}
                {feedback}
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
            onShowPanel={() => togglePanel(SidebarPanelKey.REPLAYS_ONBOARDING)}
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
    &::-webkit-scrollbar {
      background-color: transparent;
      width: 8px;
    }
    &::-webkit-scrollbar-thumb {
      background: ${p => p.theme.gray400};
      border-radius: 8px;
    }
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

const SidebarCollapseItem = styled(SidebarItem)`
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    display: none;
  }
`;
