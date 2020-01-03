import isEqual from 'lodash/isEqual';
import {withRouter, browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import classNames from 'classnames';
import createReactClass from 'create-react-class';
import styled, {css} from 'react-emotion';
import queryString from 'query-string';

import {extractSelectionParameters} from 'app/components/organizations/globalSelectionHeader/utils';
import {hideSidebar, showSidebar} from 'app/actionCreators/preferences';
import {load as loadIncidents} from 'app/actionCreators/serviceIncidents';
import {t} from 'app/locale';
import ConfigStore from 'app/stores/configStore';
import Feature from 'app/components/acl/feature';
import HookStore from 'app/stores/hookStore';
import InlineSvg from 'app/components/inlineSvg';
import PreferencesStore from 'app/stores/preferencesStore';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import theme from 'app/utils/theme';
import withLatestContext from 'app/utils/withLatestContext';

import Broadcasts from './broadcasts';
import ServiceIncidents from './serviceIncidents';
import OnboardingStatus from './onboardingStatus';
import SidebarDropdown from './sidebarDropdown';
import SidebarHelp from './help';
import SidebarItem from './sidebarItem';

class Sidebar extends React.Component {
  static propTypes = {
    router: PropTypes.object,
    organization: SentryTypes.Organization,
    collapsed: PropTypes.bool,
    location: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      horizontal: false,
      currentPanel: '',
      showPanel: false,
    };

    if (!window.matchMedia) {
      return;
    }
    // TODO(billy): We should consider moving this into a component
    this.mq = window.matchMedia(`(max-width: ${theme.breakpoints[0]})`);
    this.mq.addListener(this.handleMediaQueryChange);
    this.state.horizontal = this.mq.matches;
  }

  componentDidMount() {
    document.body.classList.add('body-sidebar');
    document.addEventListener('click', this.documentClickHandler);

    loadIncidents();

    this.hashChangeHandler();
    this.doCollapse(this.props.collapsed);
  }

  componentWillReceiveProps(nextProps) {
    const {collapsed, location} = this.props;
    const nextLocation = nextProps.location;

    // Close active panel if we navigated anywhere
    if (nextLocation && location && location.pathname !== nextLocation.pathname) {
      this.hidePanel();
    }

    if (collapsed === nextProps.collapsed) {
      return;
    }

    this.doCollapse(nextProps.collapsed);
  }

  // Sidebar doesn't use children, so don't use it to compare
  // Also ignore location, will re-render when routes change (instead of query params)
  shouldComponentUpdate(
    {children: _children, location: _location, ...nextPropsToCompare},
    nextState
  ) {
    const {
      children: _childrenCurrent,
      location: _locationCurrent,
      ...currentPropsToCompare
    } = this.props;

    return (
      !isEqual(currentPropsToCompare, nextPropsToCompare) ||
      !isEqual(this.state, nextState)
    );
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.documentClickHandler);
    document.body.classList.remove('body-sidebar');

    if (this.mq) {
      this.mq.removeListener(this.handleMediaQueryChange);
      this.mq = null;
    }

    // Unlisten to router changes
    if (this.routerListener) {
      this.routerListener();
    }
  }

  doCollapse(collapsed) {
    if (collapsed) {
      document.body.classList.add('collapsed');
    } else {
      document.body.classList.remove('collapsed');
    }
  }

  toggleSidebar = () => {
    const {collapsed} = this.props;

    if (!collapsed) {
      hideSidebar();
    } else {
      showSidebar();
    }
  };

  hashChangeHandler = () => {
    if (window.location.hash === '#welcome') {
      this.togglePanel('todos');
    }
  };

  handleMediaQueryChange = changed => {
    this.setState({
      horizontal: changed.matches,
    });
  };

  // Hide slideout panel
  hidePanel = () => {
    if (!this.state.sidePanel && this.state.currentPanel === '') {
      return;
    }

    this.setState({
      showPanel: false,
      currentPanel: '',
    });
  };

  // Keep the global selection querystring values in the path
  navigateWithGlobalSelection = (pathname, evt) => {
    const globalSelectionRoutes = [
      'dashboards',
      'issues',
      'events',
      'releases',
      'user-feedback',
      'eventsv2',
    ].map(route => `/organizations/${this.props.organization.slug}/${route}/`);

    // Only keep the querystring if the current route matches one of the above
    if (globalSelectionRoutes.includes(pathname)) {
      const query = extractSelectionParameters(this.props.location.query);

      // Handle cmd-click (mac) and meta-click (linux)
      if (evt.metaKey) {
        const q = queryString.stringify(query);
        evt.currentTarget.href = `${evt.currentTarget.href}?${q}`;
        return;
      }

      evt.preventDefault();
      browserHistory.push({pathname, query});
    }

    this.hidePanel();
  };

  // Show slideout panel
  showPanel = panel => {
    this.setState({
      showPanel: true,
      currentPanel: panel,
    });
  };

  togglePanel = panel => {
    if (this.state.currentPanel === panel) {
      this.hidePanel();
    } else {
      this.showPanel(panel);
    }
  };

  documentClickHandler = evt => {
    // If click occurs outside of sidebar, close any active panel
    if (this.sidebarRef.current && !this.sidebarRef.current.contains(evt.target)) {
      this.hidePanel();
    }
  };

  sidebarRef = React.createRef();

  render() {
    const {organization, collapsed} = this.props;
    const {currentPanel, showPanel, horizontal} = this.state;
    const config = ConfigStore.getConfig();
    const user = ConfigStore.get('user');
    const hasPanel = !!currentPanel;
    const orientation = horizontal ? 'top' : 'left';
    const sidebarItemProps = {
      orientation,
      collapsed,
      hasPanel,
    };
    const hasOrganization = !!organization;

    return (
      <StyledSidebar innerRef={this.sidebarRef} collapsed={collapsed}>
        <SidebarSectionGroupPrimary>
          <SidebarSection>
            <SidebarDropdown
              onClick={this.hidePanel}
              orientation={orientation}
              collapsed={collapsed}
              org={organization}
              user={user}
              config={config}
            />
          </SidebarSection>

          <PrimaryItems>
            {hasOrganization && (
              <React.Fragment>
                <SidebarSection>
                  <SidebarItem
                    {...sidebarItemProps}
                    index
                    onClick={this.hidePanel}
                    icon={<InlineSvg src="icon-projects" />}
                    label={t('Projects')}
                    to={`/organizations/${organization.slug}/projects/`}
                  />
                  <SidebarItem
                    {...sidebarItemProps}
                    onClick={(_id, evt) =>
                      this.navigateWithGlobalSelection(
                        `/organizations/${organization.slug}/issues/`,
                        evt
                      )
                    }
                    icon={<InlineSvg src="icon-issues" />}
                    label={t('Issues')}
                    to={`/organizations/${organization.slug}/issues/`}
                    id="issues"
                  />

                  <Feature
                    features={['events']}
                    hookName="feature-disabled:events-sidebar-item"
                    organization={organization}
                  >
                    <SidebarItem
                      {...sidebarItemProps}
                      onClick={(_id, evt) =>
                        this.navigateWithGlobalSelection(
                          `/organizations/${organization.slug}/events/`,
                          evt
                        )
                      }
                      icon={<InlineSvg src="icon-stack" />}
                      label={t('Events')}
                      to={`/organizations/${organization.slug}/events/`}
                      id="events"
                    />
                  </Feature>

                  <Feature features={['events-v2']} organization={organization}>
                    <SidebarItem
                      {...sidebarItemProps}
                      onClick={(_id, evt) =>
                        this.navigateWithGlobalSelection(
                          `/organizations/${organization.slug}/eventsv2/`,
                          evt
                        )
                      }
                      icon={<InlineSvg src="icon-telescope" />}
                      label={t('Discover v2')}
                      to={`/organizations/${organization.slug}/eventsv2/`}
                      id="discover-v2"
                    />
                  </Feature>

                  <Feature features={['incidents']} organization={organization}>
                    <SidebarItem
                      {...sidebarItemProps}
                      onClick={(_id, evt) =>
                        this.navigateWithGlobalSelection(
                          `/organizations/${organization.slug}/incidents/`,
                          evt
                        )
                      }
                      icon={<InlineSvg src="icon-siren" size="22" />}
                      label={t('Incidents')}
                      to={`/organizations/${organization.slug}/incidents/`}
                      id="incidents"
                    />
                  </Feature>

                  <SidebarItem
                    {...sidebarItemProps}
                    onClick={(_id, evt) =>
                      this.navigateWithGlobalSelection(
                        `/organizations/${organization.slug}/releases/`,
                        evt
                      )
                    }
                    icon={<InlineSvg src="icon-releases" />}
                    label={t('Releases')}
                    to={`/organizations/${organization.slug}/releases/`}
                    id="releases"
                  />
                  <SidebarItem
                    {...sidebarItemProps}
                    onClick={(_id, evt) =>
                      this.navigateWithGlobalSelection(
                        `/organizations/${organization.slug}/user-feedback/`,
                        evt
                      )
                    }
                    icon={<InlineSvg src="icon-support" size="22" />}
                    label={t('User Feedback')}
                    to={`/organizations/${organization.slug}/user-feedback/`}
                    id="user-feedback"
                  />
                </SidebarSection>

                <SidebarSection>
                  <Feature features={['discover']} organization={organization}>
                    <SidebarItem
                      {...sidebarItemProps}
                      index
                      onClick={this.hidePanel}
                      icon={<InlineSvg src="icon-health" />}
                      label={t('Dashboards')}
                      to={`/organizations/${organization.slug}/dashboards/`}
                      id="customizable-dashboards"
                    />
                  </Feature>
                  <Feature
                    features={['discover']}
                    hookName="feature-disabled:discover-sidebar-item"
                    organization={organization}
                  >
                    <SidebarItem
                      {...sidebarItemProps}
                      onClick={this.hidePanel}
                      icon={<InlineSvg src="icon-discover" />}
                      label={t('Discover')}
                      to={`/organizations/${organization.slug}/discover/`}
                      id="discover"
                    />
                  </Feature>
                  <Feature features={['monitors']} organization={organization}>
                    <SidebarItem
                      {...sidebarItemProps}
                      onClick={(_id, evt) =>
                        this.navigateWithGlobalSelection(
                          `/organizations/${organization.slug}/monitors/`,
                          evt
                        )
                      }
                      icon={<InlineSvg src="icon-labs" />}
                      label={t('Monitors')}
                      to={`/organizations/${organization.slug}/monitors/`}
                      id="monitors"
                    />
                  </Feature>
                </SidebarSection>
                <SidebarSection>
                  <SidebarItem
                    {...sidebarItemProps}
                    onClick={this.hidePanel}
                    icon={<InlineSvg src="icon-activity" size="22px" />}
                    label={t('Activity')}
                    to={`/organizations/${organization.slug}/activity/`}
                    id="activity"
                  />
                  <SidebarItem
                    {...sidebarItemProps}
                    onClick={this.hidePanel}
                    icon={<InlineSvg src="icon-stats" />}
                    label={t('Stats')}
                    to={`/organizations/${organization.slug}/stats/`}
                    id="stats"
                  />
                </SidebarSection>

                <SidebarSection>
                  <SidebarItem
                    {...sidebarItemProps}
                    onClick={this.hidePanel}
                    icon={<InlineSvg src="icon-settings" />}
                    label={t('Settings')}
                    to={`/settings/${organization.slug}/`}
                    id="settings"
                  />
                </SidebarSection>
              </React.Fragment>
            )}
          </PrimaryItems>
        </SidebarSectionGroupPrimary>

        {hasOrganization && (
          <SidebarSectionGroup>
            <SidebarSection>
              {HookStore.get('sidebar:bottom-items').length > 0 &&
                HookStore.get('sidebar:bottom-items')[0]({
                  organization,
                  ...sidebarItemProps,
                })}
              <SidebarHelp
                orientation={orientation}
                collapsed={collapsed}
                hidePanel={this.hidePanel}
                organization={organization}
              />
              <Broadcasts
                orientation={orientation}
                collapsed={collapsed}
                showPanel={showPanel}
                currentPanel={currentPanel}
                onShowPanel={() => this.togglePanel('broadcasts')}
                hidePanel={this.hidePanel}
                organization={organization}
              />
              <ServiceIncidents
                orientation={orientation}
                collapsed={collapsed}
                showPanel={showPanel}
                currentPanel={currentPanel}
                onShowPanel={() => this.togglePanel('statusupdate')}
                hidePanel={this.hidePanel}
              />
            </SidebarSection>

            {!horizontal && (
              <SidebarSection noMargin>
                <OnboardingStatus
                  org={organization}
                  currentPanel={currentPanel}
                  onShowPanel={() => this.togglePanel('todos')}
                  showPanel={showPanel}
                  hidePanel={this.hidePanel}
                  collapsed={collapsed}
                />
              </SidebarSection>
            )}

            {!horizontal && (
              <SidebarSection>
                <SidebarCollapseItem
                  data-test-id="sidebar-collapse"
                  {...sidebarItemProps}
                  icon={<StyledInlineSvg src="icon-collapse" collapsed={collapsed} />}
                  label={collapsed ? t('Expand') : t('Collapse')}
                  onClick={this.toggleSidebar}
                />
              </SidebarSection>
            )}
          </SidebarSectionGroup>
        )}
      </StyledSidebar>
    );
  }
}

const SidebarContainer = withRouter(
  createReactClass({
    displayName: 'SidebarContainer',
    mixins: [Reflux.listenTo(PreferencesStore, 'onPreferenceChange')],
    getInitialState() {
      return {
        collapsed: PreferencesStore.getInitialState().collapsed,
      };
    },

    onPreferenceChange(store) {
      if (store.collapsed === this.state.collapsed) {
        return;
      }

      this.setState({
        collapsed: store.collapsed,
      });
    },

    render() {
      return <Sidebar {...this.props} collapsed={this.state.collapsed} />;
    },
  })
);

export {Sidebar};
export default withLatestContext(SidebarContainer);

const responsiveFlex = css`
  display: flex;
  flex-direction: column;

  @media (max-width: ${theme.breakpoints[0]}) {
    flex-direction: row;
  }
`;

const StyledSidebar = styled('div')`
  background: ${p => p.theme.sidebar.background};
  background: linear-gradient(${p => p.theme.gray4}, ${p => p.theme.gray5});
  color: ${p => p.theme.sidebar.color};
  line-height: 1;
  padding: 12px 0 2px; /* Allows for 32px avatars  */
  width: ${p => p.theme.sidebar.expandedWidth};
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  justify-content: space-between;
  z-index: ${p => p.theme.zIndex.sidebar};
  ${responsiveFlex};
  ${p => p.collapsed && `width: ${p.theme.sidebar.collapsedWidth};`};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    top: 0;
    left: 0;
    right: 0;
    height: ${p => p.theme.sidebar.mobileHeight};
    bottom: auto;
    width: auto;
    padding: 0 ${space(1)};
    align-items: center;
  }
`;

const SidebarSectionGroup = styled('div')`
  ${responsiveFlex};
`;

const SidebarSectionGroupPrimary = styled(SidebarSectionGroup)`
  /* necessary for child flexing on msedge and ff */
  min-height: 0;
  min-width: 0;
  flex: 1;
  /* expand to fill the entire height on mobile */
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
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
  @media (max-height: 600px) and (min-width: ${p => p.theme.breakpoints[0]}) {
    border-bottom: 1px solid ${p => p.theme.gray3};
    padding-bottom: ${space(1)};
    box-shadow: rgba(0, 0, 0, 0.15) 0px -10px 10px inset;
    &::-webkit-scrollbar {
      background-color: transparent;
      width: 8px;
    }
    &::-webkit-scrollbar-thumb {
      background: ${p => p.theme.gray3};
      border-radius: 8px;
    }
  }
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    overflow-y: visible;
    flex-direction: row;
    height: 100%;
    align-items: center;
    border-right: 1px solid ${p => p.theme.gray3};
    padding-right: ${space(1)};
    margin-right: ${space(0.5)};
    box-shadow: rgba(0, 0, 0, 0.15) -10px 0px 10px inset;
    ::-webkit-scrollbar {
      display: none;
    }
  }
`;

const SidebarSection = styled(SidebarSectionGroup)`
  ${p => !p.noMargin && `margin: ${space(1)} 0`};
  padding: 0 19px;

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
  transform: rotate(0deg);
`;
const CollapsedIcon = css`
  transform: rotate(180deg);
`;
const StyledInlineSvg = styled(({className, collapsed, ...props}) => (
  <InlineSvg
    className={classNames(className, ExpandedIcon, collapsed && CollapsedIcon)}
    {...props}
  />
))``;

const SidebarCollapseItem = styled(SidebarItem)`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;
