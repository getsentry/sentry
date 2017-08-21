import React from 'react';
import $ from 'jquery';

import ApiMixin from '../../mixins/apiMixin';
import DropdownLink from '../dropdownLink';
import MenuItem from '../menuItem';
import OrganizationState from '../../mixins/organizationState';
import {load as loadIncidents} from '../../actionCreators/incidents';
import {t} from '../../locale';

import Broadcasts from './broadcasts';
import Incidents from './incidents';
import UserNav from './userNav';
import requiredAdminActions from '../requiredAdminActions';
import OrganizationSelector from './organizationSelector';
import SidebarPanel from './sidebarPanel';
import SidebarItem from './sidebarItem';
import TodoList from '../todos';
import IssueList from '../issueList';
import ConfigStore from '../../stores/configStore';

import IconSidebarOverview from '../../icons/icon-sidebar-overview';
import IconSidebarIssues from '../../icons/icon-sidebar-issues';
import IconSidebarUserFeedback from '../../icons/icon-sidebar-user-feedback';
import IconSidebarReleases from '../../icons/icon-sidebar-releases';
import IconSidebarSettings from '../../icons/icon-sidebar-settings';
import IconSidebarUser from '../../icons/icon-sidebar-user';
import IconSidebarBookmarks from '../../icons/icon-sidebar-bookmarks';
import IconSidebarHistory from '../../icons/icon-sidebar-history';
import IconSidebarSupport from '../../icons/icon-sidebar-support';
import IconSidebarStatus from '../../icons/icon-sidebar-status';
import IconSidebarCollapse from '../../icons/icon-sidebar-collapse';

const OnboardingStatus = React.createClass({
  propTypes: {
    org: React.PropTypes.object.isRequired,
    currentPanel: React.PropTypes.string,
    onShowPanel: React.PropTypes.func,
    showPanel: React.PropTypes.bool,
    hidePanel: React.PropTypes.func
  },

  render() {
    let org = this.props.org;
    if (org.features.indexOf('onboarding') === -1) return null;

    let percentage = Math.round(
      (org.onboardingTasks || [])
        .filter(task => task.status === 'complete' || task.status === 'skipped').length /
        TodoList.TASKS.length *
        100
    ).toString();
    let style = {
      height: percentage + '%'
    };

    return (
      <li
        className={
          this.props.currentPanel == 'todos' ? 'onboarding active' : 'onboarding'
        }>
        <div className="onboarding-progress-bar" onClick={this.props.onShowPanel}>
          <div className="slider" style={style} />
        </div>
        {this.props.showPanel &&
          this.props.currentPanel == 'todos' &&
          <SidebarPanel
            title="Getting Started with Sentry"
            hidePanel={this.props.hidePanel}>
            <TodoList />
          </SidebarPanel>}
      </li>
    );
  }
});

function getFirstRequiredAdminAction(org) {
  for (let key in requiredAdminActions) {
    let action = requiredAdminActions[key];
    if (action.requiresAction(org)) {
      return action;
    }
  }
  return null;
}

const OldSidebar = React.createClass({
  contextTypes: {
    location: React.PropTypes.object
  },

  mixins: [ApiMixin, OrganizationState],

  getInitialState: function() {
    return {
      showTodos: location.hash === '#welcome'
    };
  },

  componentDidMount() {
    $(window).on('hashchange', this.hashChangeHandler);
    $(document).on('click', this.documentClickHandler);

    loadIncidents();
  },

  componentWillReceiveProps(nextProps, nextContext) {
    let {location} = this.context;
    let nextLocation = nextContext.location;

    // Close active panel if we navigated anywhere
    if (location.pathname != nextLocation.pathname) {
      this.hidePanel();
    }
  },

  componentWillUnmount() {
    $(window).off('hashchange', this.hashChangeHandler);
    $(document).off('click', this.documentClickHandler);
  },

  documentClickHandler(evt) {
    // If click occurs outside of sidebar, close any
    // active panel
    if (!this.refs.navbar.contains(evt.target)) {
      this.hidePanel();
    }
  },

  hashChangeHandler() {
    if (location.hash == '#welcome') {
      this.setState({showTodos: true});
    }
  },

  toggleTodos(e) {
    this.setState({showTodos: !this.state.showTodos});
  },

  hidePanel() {
    this.setState({
      showPanel: false,
      currentPanel: ''
    });
  },

  showPanel(panel) {
    this.setState({
      showPanel: true,
      currentPanel: panel
    });
  },

  togglePanel(panel) {
    if (this.state.currentPanel === panel) this.hidePanel();
    else this.showPanel(panel);
  },

  renderBody() {
    let org = this.getOrganization();
    let config = ConfigStore.getConfig();

    if (!org) {
      // When no organization, just render Sentry logo at top
      return (
        <ul className="navbar-nav">
          <li><a className="logo" href="/"><span className="icon-sentry-logo" /></a></li>
        </ul>
      );
    }

    return (
      <div>
        <OrganizationSelector
          organization={org}
          showPanel={this.state.showPanel}
          currentPanel={this.state.currentPanel}
          togglePanel={() => this.togglePanel('org-selector')}
          hidePanel={() => this.hidePanel()}
        />

        {/* Top nav links */}
        <ul className="navbar-nav divider-bottom">
          <li className={this.state.currentPanel == 'assigned' ? 'active' : null}>
            <a title="Assigned to me">
              <span
                className="icon icon-user"
                onClick={() => this.togglePanel('assigned')}
              />
              <span className="navbar-label">Assigned to me</span>
            </a>
          </li>
          <li className={this.state.currentPanel == 'bookmarks' ? 'active' : null}>
            <a title="My Bookmarks">
              <span
                className="icon icon-star-solid"
                onClick={() => this.togglePanel('bookmarks')}
              />
              <span className="navbar-label">Starred issues</span>
            </a>
          </li>
          <li className={this.state.currentPanel == 'history' ? 'active' : null}>
            <a title="Recently Viewed">
              <span
                className="icon icon-av_timer"
                onClick={() => this.togglePanel('history')}
              />
              <span className="navbar-label">Recently viewed</span>
            </a>
          </li>
        </ul>
        <ul className="navbar-nav">
          <Broadcasts
            showPanel={this.state.showPanel}
            currentPanel={this.state.currentPanel}
            onShowPanel={() => this.togglePanel('broadcasts')}
            hidePanel={() => this.hidePanel()}
          />
          <span className="navbar-label">What's new</span>
          <Incidents
            showPanel={this.state.showPanel}
            currentPanel={this.state.currentPanel}
            onShowPanel={() => this.togglePanel('statusupdate')}
            hidePanel={() => this.hidePanel()}
          />
          <li>
            <a
              title="Support"
              href={
                !config.isOnPremise
                  ? `/organizations/${org.slug}/support/`
                  : 'https://forum.sentry.io/'
              }>
              <span className="icon icon-support" />
              <span className="navbar-label">Support</span>
            </a>
          </li>
        </ul>

      </div>
    );
  },

  renderRequiredActions() {
    // TODO: investigate if this is seriously deprecated
    let org = this.getOrganization();
    let requiredAction = org && getFirstRequiredAdminAction(org);

    if (org && requiredAction !== null) {
      let slugId = requiredAction.ID.toLowerCase().replace(/_/g, '-');
      let url = `/organizations/${org.slug}/actions/${slugId}/`;
      return (
        <span className="admin-action-message">
          <a href={url}>
            {t('Required Action:')}{' '}{requiredAction.getActionLinkTitle()}
          </a>
        </span>
      );
    }

    return null;
  },

  render() {
    let org = this.getOrganization();

    // NOTE: this.props.orgId not guaranteed to be specified
    return (
      <nav className="navbar" role="navigation" ref="navbar">
        <div className="anchor-top">
          {this.renderBody()}
        </div>

        {/* Bottom nav links */}
        <div className="anchor-bottom">
          <ul className="navbar-nav">
            {org &&
              <OnboardingStatus
                org={org}
                showPanel={this.state.showPanel}
                currentPanel={this.state.currentPanel}
                onShowPanel={() => this.togglePanel('todos')}
                hidePanel={() => this.hidePanel()}
              />}

            <li>
              <UserNav className="user-settings" />
            </li>
          </ul>
        </div>

        {this.renderRequiredActions()}
      </nav>
    );
  }
});

const SidebarSection = React.createClass({
  render() {
    return (
      <div className="sidebar-section">
        {this.props.children}
      </div>
    );
  }
});

const UserDropdown = React.createClass({
  contextTypes: {
    location: React.PropTypes.object
  },
  render() {
    const org = this.props.org;
    let user = ConfigStore.get('user');

    let to = url => (this.context.location ? {to: url} : {href: url});

    return (
      <div className="user-dropdown">
        {this.props.collapsed && <div className="user-dropdown-org-icon" />}
        {!this.props.collapsed &&
          <div>
            <div className="user-dropdown-org-name">
              <DropdownLink caret={true} title={org.name}>
                <MenuItem header>{org.name}</MenuItem>
                <MenuItem href={`/organizations/${org.slug}/settings/`}>
                  {t('Organization settings')}
                </MenuItem>
                <MenuItem href={`/organizations/${org.slug}/teams/`}>
                  {t('Projects')}
                </MenuItem>
                <MenuItem href={`/organizations/${org.slug}/members/`}>
                  {t('Members')}
                </MenuItem>
                <MenuItem>Switch organizations...</MenuItem>
                <MenuItem divider />
                <MenuItem header>{user.name}</MenuItem>
                <MenuItem href="/account/settings/">{t('Account settings')}</MenuItem>
                <MenuItem {...to('/api/')}>{t('API keys')}</MenuItem>
                {user.isSuperuser &&
                  <MenuItem {...to('/manage/')}>{t('Admin')}</MenuItem>}
                <MenuItem href="/auth/logout/">{t('Sign out')}</MenuItem>
              </DropdownLink>
            </div>
            <div className="user-dropdown-user-name">{user.name}</div>
          </div>}
      </div>
    );
  }
});

const Sidebar = React.createClass({
  contextTypes: {
    location: React.PropTypes.object
  },

  mixins: [ApiMixin, OrganizationState],

  getInitialState: function() {
    return {
      collapsed: false
    };
  },

  componentWillMount() {
    jQuery(document.body).addClass('body-sidebar');
  },

  componentDidMount() {
    jQuery(window).on('hashchange', this.hashChangeHandler);
    jQuery(document).on('click', this.documentClickHandler);

    loadIncidents();
  },

  componentWillReceiveProps(nextProps, nextContext) {
    let {location} = this.context;
    let nextLocation = nextContext.location;

    // Close active panel if we navigated anywhere
    if (location.pathname != nextLocation.pathname) {
      this.hidePanel();
    }
  },

  componentWillUnmount() {
    jQuery(window).off('hashchange', this.hashChangeHandler);
    jQuery(document).off('click', this.documentClickHandler);
    jQuery(document.body).removeClass('body-sidebar');
  },

  toggleSidebar() {
    this.setState({
      collapsed: !this.state.collapsed
    });
    if (!this.state.collapsed) {
      jQuery(document.body).addClass('collapsed');
    } else {
      jQuery(document.body).removeClass('collapsed');
    }
  },

  hidePanel() {
    this.setState({
      showPanel: false,
      currentPanel: ''
    });
  },

  showPanel(panel) {
    this.setState({
      showPanel: true,
      currentPanel: panel
    });
  },

  togglePanel(panel) {
    if (this.state.currentPanel === panel) this.hidePanel();
    else this.showPanel(panel);
  },

  documentClickHandler(evt) {
    // If click occurs outside of sidebar, close any
    // active panel
    if (!this.refs.sidebar.contains(evt.target)) {
      this.hidePanel();
    }
  },

  render() {
    let org = this.getOrganization();
    let config = ConfigStore.getConfig();

    let classNames = 'sidebar ';

    if (this.state.collapsed) {
      classNames += ' collapsed';
    }

    return (
      <div className={classNames} ref="sidebar">
        <div className="sidebar-top">
          <SidebarSection>
            <UserDropdown collapsed={this.state.collapsed} org={org} />
          </SidebarSection>
          <hr />
          <SidebarSection>
            <SidebarItem
              icon={<IconSidebarOverview size={22} />}
              label={t('Activity')}
              onClick={() => this.togglePanel('activity')}
            />
            <SidebarItem
              icon={<IconSidebarIssues size={22} />}
              label={t('New issues')}
              onClick={() => this.togglePanel('new')}
            />
          </SidebarSection>
          <hr />
          <SidebarSection>
            <SidebarItem
              active={this.state.currentPanel == 'assigned'}
              icon={<IconSidebarUser size={22} />}
              label={t('Assigned to me')}
              onClick={() => this.togglePanel('assigned')}
            />
            <SidebarItem
              active={this.state.currentPanel == 'bookmarks'}
              icon={<IconSidebarBookmarks size={22} />}
              label={t('Starred issues')}
              onClick={() => this.togglePanel('bookmarks')}
            />
            <SidebarItem
              active={this.state.currentPanel == 'history'}
              icon={<IconSidebarHistory size={22} />}
              label={t('Recently viewed')}
              onClick={() => this.togglePanel('history')}
            />
          </SidebarSection>
          <hr />
          <SidebarSection>
            <Broadcasts
              showPanel={this.state.showPanel}
              currentPanel={this.state.currentPanel}
              onShowPanel={() => this.togglePanel('broadcasts')}
              hidePanel={() => this.hidePanel()}
            />
            {!config.isOnPremise
              ? <SidebarItem
                  icon={<IconSidebarSupport size={22} />}
                  label={t('Support')}
                  to="/organizations/${org.slug}/support/"
                />
              : <SidebarItem
                  icon={<IconSidebarSupport size={22} />}
                  label={t('Support forum')}
                  href="https://forum.sentry.io/"
                />}

            <SidebarItem
              icon={<IconSidebarStatus size={22} />}
              label={t('Service status')}
              onClick={() => this.togglePanel('history')}
            />
          </SidebarSection>
        </div>
        <div className="sidebar-bottom">
          <hr />
          <SidebarSection>
            <SidebarItem
              icon={<IconSidebarCollapse size={22} className="toggle-collapse-icon" />}
              label={t('Collapse')}
              onClick={() => this.toggleSidebar()}
            />
          </SidebarSection>
        </div>

        {/* Panel bodies */}
        {this.state.showPanel &&
          this.state.currentPanel == 'assigned' &&
          <SidebarPanel title={t('Assigned to me')} hidePanel={() => this.hidePanel()}>
            <IssueList
              endpoint={`/organizations/${org.slug}/members/me/issues/assigned/`}
              query={{
                statsPeriod: '24h',
                per_page: 10,
                status: 'unresolved'
              }}
              pagination={false}
              renderEmpty={() => (
                <div className="sidebar-panel-empty" key="none">
                  {t('No issues have been assigned to you.')}
                </div>
              )}
              ref="issueList"
              showActions={false}
              params={{orgId: org.slug}}
            />
          </SidebarPanel>}
        {this.state.showPanel &&
          this.state.currentPanel == 'bookmarks' &&
          <SidebarPanel title={t('My Bookmarks')} hidePanel={() => this.hidePanel()}>
            <IssueList
              endpoint={`/organizations/${org.slug}/members/me/issues/bookmarked/`}
              query={{
                statsPeriod: '24h',
                per_page: 10,
                status: 'unresolved'
              }}
              pagination={false}
              renderEmpty={() => (
                <div className="sidebar-panel-empty" key="no">
                  {t('You have no bookmarked issues.')}
                </div>
              )}
              ref="issueList"
              showActions={false}
              params={{orgId: org.slug}}
            />
          </SidebarPanel>}
        {this.state.showPanel &&
          this.state.currentPanel == 'history' &&
          <SidebarPanel title={t('Recently Viewed')} hidePanel={() => this.hidePanel()}>
            <IssueList
              endpoint={`/organizations/${org.slug}/members/me/issues/viewed/`}
              query={{
                statsPeriod: '24h',
                per_page: 10,
                status: 'unresolved'
              }}
              pagination={false}
              renderEmpty={() => (
                <div className="sidebar-panel-empty" key="none">
                  {t('No recently viewed issues.')}
                </div>
              )}
              ref="issueList"
              showActions={false}
              params={{orgId: org.slug}}
            />
          </SidebarPanel>}
      </div>
    );
  }
});

export default Sidebar;
