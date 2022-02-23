import {Fragment, useEffect} from 'react';
import {browserHistory} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';
import * as qs from 'query-string';

import {hideSidebar, showSidebar} from 'sentry/actionCreators/preferences';
import SidebarPanelActions from 'sentry/actions/sidebarPanelActions';
import Feature from 'sentry/components/acl/feature';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {
  extractSelectionParameters,
  getPathsWithNewFilters,
} from 'sentry/components/organizations/pageFilters/utils';
import {
  IconChevron,
  IconDashboard,
  IconIssues,
  IconLab,
  IconLightning,
  IconList,
  IconProject,
  IconReleases,
  IconSettings,
  IconSiren,
  IconSpan,
  IconStats,
  IconSupport,
  IconTelescope,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import PreferencesStore from 'sentry/stores/preferencesStore';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {getDiscoverLandingUrl} from 'sentry/utils/discover/urls';
import theme from 'sentry/utils/theme';
import useMedia from 'sentry/utils/useMedia';

import Broadcasts from './broadcasts';
import SidebarHelp from './help';
import OnboardingStatus from './onboardingStatus';
import ServiceIncidents from './serviceIncidents';
import SidebarDropdown from './sidebarDropdown';
import SidebarItem from './sidebarItem';
import {SidebarOrientation, SidebarPanelKey} from './types';

const SidebarOverride = HookOrDefault({
  hookName: 'sidebar:item-override',
  defaultComponent: ({children}) => <Fragment>{children({})}</Fragment>,
});

type Props = {
  location?: Location;
  organization?: Organization;
};

function Sidebar({location, organization}: Props) {
  const config = useLegacyStore(ConfigStore);
  const preferences = useLegacyStore(PreferencesStore);
  const activePanel = useLegacyStore(SidebarPanelStore);

  const collapsed = !!preferences.collapsed;
  const horizontal = useMedia(`(max-width: ${theme.breakpoints[1]})`);

  const toggleCollapse = () => {
    const action = collapsed ? showSidebar : hideSidebar;
    action();
  };

  const togglePanel = (panel: SidebarPanelKey) => SidebarPanelActions.togglePanel(panel);
  const hidePanel = () => SidebarPanelActions.hidePanel();

  const bcl = document.body.classList;

  // Close panel on any navigation
  useEffect(() => void hidePanel(), [location?.pathname]);

  // Add classname to body
  useEffect(() => {
    bcl.add('body-sidebar');
    return () => bcl.remove('body-sidebar');
  }, []);

  // Add sidebar collapse classname to body
  useEffect(() => {
    if (collapsed) {
      bcl.add('collapsed');
    } else {
      bcl.remove('collapsed');
    }

    return () => bcl.remove('collapsed');
  }, [collapsed]);

  // Trigger panels depending on the location hash
  useEffect(() => {
    if (location?.hash === '#welcome') {
      togglePanel(SidebarPanelKey.OnboardingWizard);
    }
  }, [location?.hash]);

  /**
   * Navigate to a path, but keep the page filter query strings.
   */
  const navigateWithPageFilters = (
    pathname: string,
    evt: React.MouseEvent<HTMLAnchorElement>
  ) => {
    // XXX(epurkhiser): No need to navigate w/ the page filters in the world
    // of new page filter selection. You must pin your filters in which case
    // they will persist anyway.
    if (organization) {
      if (getPathsWithNewFilters(organization).includes(pathname)) {
        return;
      }
    }

    const globalSelectionRoutes = [
      'alerts',
      'alerts/rules',
      'dashboards',
      'issues',
      'releases',
      'user-feedback',
      'discover',
      'discover/results', // Team plans do not have query landing page
      'performance',
    ].map(route => `/organizations/${organization?.slug}/${route}/`);

    // Only keep the querystring if the current route matches one of the above
    if (globalSelectionRoutes.includes(pathname)) {
      const query = extractSelectionParameters(location?.query ?? {});

      // Handle cmd-click (mac) and meta-click (linux)
      if (evt.metaKey) {
        const q = qs.stringify(query);
        evt.currentTarget.href = `${evt.currentTarget.href}?${q}`;
        return;
      }

      evt.preventDefault();
      browserHistory.push({pathname, query});
    }
  };

  const hasPanel = !!activePanel;
  const hasOrganization = !!organization;
  const orientation: SidebarOrientation = horizontal ? 'top' : 'left';

  const sidebarItemProps = {
    orientation,
    collapsed,
    hasPanel,
  };

  const projects = hasOrganization && (
    <SidebarItem
      {...sidebarItemProps}
      index
      icon={<IconProject size="md" />}
      label={<GuideAnchor target="projects">{t('Projects')}</GuideAnchor>}
      to={`/organizations/${organization.slug}/projects/`}
      id="projects"
    />
  );

  const issues = hasOrganization && (
    <SidebarItem
      {...sidebarItemProps}
      onClick={(_id, evt) =>
        navigateWithPageFilters(`/organizations/${organization.slug}/issues/`, evt)
      }
      icon={<IconIssues size="md" />}
      label={<GuideAnchor target="issues">{t('Issues')}</GuideAnchor>}
      to={`/organizations/${organization.slug}/issues/`}
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
        onClick={(_id, evt) =>
          navigateWithPageFilters(getDiscoverLandingUrl(organization), evt)
        }
        icon={<IconTelescope size="md" />}
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
      <SidebarOverride id="performance-override">
        {(overideProps: Partial<React.ComponentProps<typeof SidebarItem>>) => (
          <SidebarItem
            {...sidebarItemProps}
            onClick={(_id, evt) =>
              navigateWithPageFilters(
                `/organizations/${organization.slug}/performance/`,
                evt
              )
            }
            icon={<IconLightning size="md" />}
            label={<GuideAnchor target="performance">{t('Performance')}</GuideAnchor>}
            to={`/organizations/${organization.slug}/performance/`}
            id="performance"
            {...overideProps}
          />
        )}
      </SidebarOverride>
    </Feature>
  );

  const releases = hasOrganization && (
    <SidebarItem
      {...sidebarItemProps}
      onClick={(_id, evt) =>
        navigateWithPageFilters(`/organizations/${organization.slug}/releases/`, evt)
      }
      icon={<IconReleases size="md" />}
      label={<GuideAnchor target="releases">{t('Releases')}</GuideAnchor>}
      to={`/organizations/${organization.slug}/releases/`}
      id="releases"
    />
  );

  const userFeedback = hasOrganization && (
    <SidebarItem
      {...sidebarItemProps}
      onClick={(_id, evt) =>
        navigateWithPageFilters(`/organizations/${organization.slug}/user-feedback/`, evt)
      }
      icon={<IconSupport size="md" />}
      label={t('User Feedback')}
      to={`/organizations/${organization.slug}/user-feedback/`}
      id="user-feedback"
    />
  );

  const alerts = hasOrganization && (
    <SidebarItem
      {...sidebarItemProps}
      onClick={(_id, evt) =>
        navigateWithPageFilters(`/organizations/${organization.slug}/alerts/rules/`, evt)
      }
      icon={<IconSiren size="md" />}
      label={t('Alerts')}
      to={`/organizations/${organization.slug}/alerts/rules/`}
      id="alerts"
    />
  );

  const monitors = hasOrganization && (
    <Feature features={['monitors']} organization={organization}>
      <SidebarItem
        {...sidebarItemProps}
        onClick={(_id, evt) =>
          navigateWithPageFilters(`/organizations/${organization.slug}/monitors/`, evt)
        }
        icon={<IconLab size="md" />}
        label={t('Monitors')}
        to={`/organizations/${organization.slug}/monitors/`}
        id="monitors"
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
        onClick={(_id, evt) =>
          navigateWithPageFilters(`/organizations/${organization.slug}/dashboards/`, evt)
        }
        icon={<IconDashboard size="md" />}
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
        onClick={(_id, evt) =>
          navigateWithPageFilters(`/organizations/${organization.slug}/profiling/`, evt)
        }
        icon={<IconSpan size="md" />}
        label={t('Profiling')}
        to={`/organizations/${organization.slug}/profiling/`}
        id="profiling"
      />
    </Feature>
  );

  const activity = hasOrganization && (
    <SidebarItem
      {...sidebarItemProps}
      icon={<IconList size="md" />}
      label={t('Activity')}
      to={`/organizations/${organization.slug}/activity/`}
      id="activity"
    />
  );

  const stats = hasOrganization && (
    <SidebarItem
      {...sidebarItemProps}
      icon={<IconStats size="md" />}
      label={t('Stats')}
      to={`/organizations/${organization.slug}/stats/`}
      id="stats"
    />
  );

  const settings = hasOrganization && (
    <SidebarItem
      {...sidebarItemProps}
      icon={<IconSettings size="md" />}
      label={t('Settings')}
      to={`/settings/${organization.slug}/`}
      id="settings"
    />
  );

  return (
    <SidebarWrapper collapsed={collapsed}>
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
                {projects}
                {issues}
                {performance}
                {releases}
                {userFeedback}
                {alerts}
                {discover2}
                {dashboards}
                {profiling}
              </SidebarSection>

              <SidebarSection>{monitors}</SidebarSection>

              <SidebarSection>
                {activity}
                {stats}
              </SidebarSection>

              <SidebarSection>{settings}</SidebarSection>
            </Fragment>
          )}
        </PrimaryItems>
      </SidebarSectionGroupPrimary>

      {hasOrganization && (
        <SidebarSectionGroup>
          <SidebarSection noMargin noPadding>
            <OnboardingStatus
              org={organization}
              currentPanel={activePanel}
              onShowPanel={() => togglePanel(SidebarPanelKey.OnboardingWizard)}
              hidePanel={hidePanel}
              {...sidebarItemProps}
            />
          </SidebarSection>

          <SidebarSection>
            {HookStore.get('sidebar:bottom-items').length > 0 &&
              HookStore.get('sidebar:bottom-items')[0]({
                organization,
                ...sidebarItemProps,
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
              onShowPanel={() => togglePanel(SidebarPanelKey.Broadcasts)}
              hidePanel={hidePanel}
              organization={organization}
            />
            <ServiceIncidents
              orientation={orientation}
              collapsed={collapsed}
              currentPanel={activePanel}
              onShowPanel={() => togglePanel(SidebarPanelKey.StatusUpdate)}
              hidePanel={hidePanel}
            />
          </SidebarSection>

          {!horizontal && (
            <SidebarSection>
              <SidebarCollapseItem
                id="collapse"
                data-test-id="sidebar-collapse"
                {...sidebarItemProps}
                icon={<StyledIconChevron collapsed={collapsed} />}
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

  @media (max-width: ${theme.breakpoints[1]}) {
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

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
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
`;

const SidebarSectionGroupPrimary = styled('div')`
  ${responsiveFlex};
  /* necessary for child flexing on msedge and ff */
  min-height: 0;
  min-width: 0;
  flex: 1;
  /* expand to fill the entire height on mobile */
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    height: 100%;
    align-items: center;
  }
`;

const PrimaryItems = styled('div')`
  overflow: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  -ms-overflow-style: -ms-autohiding-scrollbar;
  @media (max-height: 675px) and (min-width: ${p => p.theme.breakpoints[1]}) {
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
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
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

const SidebarSection = styled(SidebarSectionGroup)<{
  noMargin?: boolean;
  noPadding?: boolean;
}>`
  ${p => !p.noMargin && `margin: ${space(1)} 0`};
  ${p => !p.noPadding && 'padding: 0 19px'};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    margin: 0;
    padding: 0;
  }

  &:empty {
    display: none;
  }
`;

const ExpandedIcon = css`
  transition: 0.3s transform ease;
  transform: rotate(270deg);
`;
const CollapsedIcon = css`
  transform: rotate(90deg);
`;
const StyledIconChevron = styled(({collapsed, ...props}) => (
  <IconChevron
    direction="left"
    size="md"
    isCircled
    css={[ExpandedIcon, collapsed && CollapsedIcon]}
    {...props}
  />
))``;

const SidebarCollapseItem = styled(SidebarItem)`
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    display: none;
  }
`;
