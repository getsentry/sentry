import {withRouter} from 'react-router';
import $ from 'jquery';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled, {css, cx} from 'react-emotion';

import {hideSidebar, loadSidebarState, showSidebar} from 'app/actionCreators/sidebar';
import {load as loadIncidents} from 'app/actionCreators/incidents';
import {t} from 'app/locale';
import ConfigStore from 'app/stores/configStore';
import InlineSvg from 'app/components/inlineSvg';
import SentryTypes from 'app/proptypes';
import SidebarStore from 'app/stores/sidebarStore';
import theme from 'app/utils/theme';
import space from 'app/styles/space';
import withLatestContext from 'app/utils/withLatestContext';

import Broadcasts from './broadcasts';
import Incidents from './incidents';
import SidebarDropdown from './sidebarDropdown';
import SidebarItem from './sidebarItem';
import OnboardingStatus from './onboardingStatus';

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
    };

    if (!window.matchMedia) return;
    // TODO(billy): We should consider moving this into a component
    this.mq = window.matchMedia(`(max-width: ${theme.breakpoints[0]})`);
    this.mq.addListener(this.handleMediaQueryChange);
    this.state.horizontal = this.mq.matches;
  }

  componentDidMount() {
    let {router} = this.props;
    jQuery(document.body).addClass('body-sidebar');
    jQuery(document).on('click', this.documentClickHandler);

    loadIncidents();
    loadSidebarState();

    // router can potentially not exist in server side (django) views
    // Otherwise when we change routes using collapsed sidebar, the tooltips will remain after
    // route changes.
    this.routerListener =
      router &&
      router.listen(() => {
        $('.tooltip').tooltip('hide');
      });
    this.doCollapse(this.props.collapsed);
  }

  componentWillReceiveProps(nextProps) {
    let {collapsed, location} = this.props;
    let nextLocation = nextProps.location;

    // Close active panel if we navigated anywhere
    if (nextLocation && location && location.pathname !== nextLocation.pathname) {
      this.hidePanel();
    }

    if (collapsed === nextProps.collapsed) return;

    this.doCollapse(nextProps.collapsed);
  }

  componentWillUnmount() {
    jQuery(document).off('click', this.documentClickHandler);
    jQuery(document.body).removeClass('body-sidebar');

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
      jQuery(document.body).addClass('collapsed');
    } else {
      jQuery(document.body).removeClass('collapsed');
    }
  }

  toggleSidebar = () => {
    let {collapsed} = this.props;

    if (!collapsed) {
      hideSidebar();
    } else {
      showSidebar();
    }
  };

  hashChangeHandler = () => {
    if (window.location.hash == '#welcome') {
      this.setState({showTodos: true});
    }
  };

  handleMediaQueryChange = changed => {
    this.setState({
      horizontal: changed.matches,
    });
  };

  // Hide slideout panel
  hidePanel = () => {
    if (!this.state.sidePanel && this.state.currentPanel === '') return;

    this.setState({
      showPanel: false,
      currentPanel: '',
    });
  };

  // Show slideout panel
  showPanel = panel => {
    this.setState({
      showPanel: true,
      currentPanel: panel,
    });
  };

  togglePanel = (panel, e) => {
    if (this.state.currentPanel === panel) this.hidePanel();
    else this.showPanel(panel);
  };

  documentClickHandler = evt => {
    // If click occurs outside of sidebar, close any active panel
    if (this.sidebar && !this.sidebar.contains(evt.target)) {
      this.hidePanel();
    }
  };

  render() {
    let {organization, collapsed} = this.props;
    let {currentPanel, showPanel, horizontal} = this.state;
    let config = ConfigStore.getConfig();
    let user = ConfigStore.get('user');
    let hasPanel = !!currentPanel;
    let orientation = horizontal ? 'top' : 'left';
    let sidebarItemProps = {
      orientation,
      collapsed,
      hasPanel,
    };
    let hasOrganization = !!organization;

    return (
      <StyledSidebar
        innerRef={ref => (this.sidebar = ref)}
        collapsed={hasOrganization ? collapsed : true}
      >
        <SidebarSectionGroup>
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

          {hasOrganization && (
            <React.Fragment>
              <SidebarSection>
                <SidebarItem
                  {...sidebarItemProps}
                  index
                  onClick={this.hidePanel}
                  icon={<InlineSvg src="icon-projects" />}
                  label={t('Projects')}
                  to={`/${organization.slug}/`}
                />
              </SidebarSection>

              <SidebarSection>
                <SidebarItem
                  {...sidebarItemProps}
                  onClick={this.hidePanel}
                  icon={<InlineSvg src="icon-user" />}
                  label={t('Assigned to me')}
                  to={`/organizations/${organization.slug}/issues/assigned/`}
                />
                <SidebarItem
                  {...sidebarItemProps}
                  onClick={this.hidePanel}
                  icon={<InlineSvg src="icon-star" />}
                  label={t('Starred issues')}
                  to={`/organizations/${organization.slug}/issues/bookmarks/`}
                />
                <SidebarItem
                  {...sidebarItemProps}
                  onClick={this.hidePanel}
                  icon={<InlineSvg src="icon-history" />}
                  label={t('Recently viewed')}
                  to={`/organizations/${organization.slug}/issues/history/`}
                />
              </SidebarSection>

              <SidebarSection>
                <SidebarItem
                  {...sidebarItemProps}
                  onClick={this.hidePanel}
                  icon={<InlineSvg src="icon-activity" />}
                  label={t('Activity')}
                  to={`/organizations/${organization.slug}/activity/`}
                />
                <SidebarItem
                  {...sidebarItemProps}
                  onClick={this.hidePanel}
                  icon={<InlineSvg src="icon-stats" />}
                  label={t('Stats')}
                  to={`/organizations/${organization.slug}/stats/`}
                />
              </SidebarSection>
            </React.Fragment>
          )}
        </SidebarSectionGroup>

        {hasOrganization && (
          <SidebarSectionGroup>
            <SidebarSection>
              <Broadcasts
                orientation={orientation}
                collapsed={collapsed}
                showPanel={showPanel}
                currentPanel={currentPanel}
                onShowPanel={() => this.togglePanel('broadcasts')}
                hidePanel={this.hidePanel}
              />
              <Incidents
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
    mixins: [Reflux.connect(SidebarStore, 'sidebar')],

    render() {
      return (
        <Sidebar
          {...this.props}
          collapsed={this.state.sidebar && this.state.sidebar.collapsed}
        />
      );
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
  padding: 12px 19px 2px; /* Allows for 32px avatars  */
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
    padding: 0;
    align-items: center;
  }
`;

const SidebarSectionGroup = styled('div')`
  ${responsiveFlex};
  flex-shrink: 0;
`;

const SidebarSection = styled(SidebarSectionGroup)`
  ${p => !p.noMargin && `margin: ${space(1)} 0`};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    margin: 0 ${space(1)};
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
    className={cx(className, ExpandedIcon, collapsed && CollapsedIcon)}
    {...props}
  />
))``;

const SidebarCollapseItem = styled(SidebarItem)`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;
