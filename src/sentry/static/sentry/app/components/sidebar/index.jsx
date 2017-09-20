import PropTypes from 'prop-types';
import React from 'react';
import $ from 'jquery';
import Cookies from 'js-cookie';

import Avatar from '../avatar';
import ApiMixin from '../../mixins/apiMixin';
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
import TodoList from '../onboardingWizard/todos';
import IssueList from '../issueList';
import ConfigStore from '../../stores/configStore';

import IconSidebarOverview from '../../icons/icon-sidebar-overview';
import IconSidebarIssues from '../../icons/icon-sidebar-issues';
import IconSidebarUser from '../../icons/icon-sidebar-user';
import IconSidebarBookmarks from '../../icons/icon-sidebar-bookmarks';
import IconSidebarHistory from '../../icons/icon-sidebar-history';
import IconSidebarSupport from '../../icons/icon-sidebar-support';
import IconSidebarCollapse from '../../icons/icon-sidebar-collapse';

const OnboardingStatus = React.createClass({
  propTypes: {
    org: PropTypes.object.isRequired,
    currentPanel: PropTypes.string,
    onShowPanel: PropTypes.func,
    showPanel: PropTypes.bool,
    hidePanel: PropTypes.func
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
    location: PropTypes.object
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
      <div className="sidebar-section" {...this.props}>
        {this.props.children}
      </div>
    );
  }
});

const UserSummary = React.createClass({
  render() {
    let user = ConfigStore.get('user');

    return (
      <div className="sidebar-user-summary">
        <div className="sidebar-user-summary-avatar">
          <Avatar user={user} className="avatar" />
        </div>
        <div className="sidebar-org-summary-user-name">{this.props.user.name}</div>
      </div>
    );
  }
});

const OrgSummary = React.createClass({
  render() {
    return (
      <div className="sidebar-org-summary">
        <div className="sidebar-org-summary-avatar">
          <div className="org-avatar" />
        </div>
        <div className="sidebar-org-summary-details">
          <div className="sidebar-org-summary-org-name">{this.props.org.name}</div>
          <div className="sidebar-org-summary-org-details">13 projects, 24 members</div>
        </div>
      </div>
    );
  }
});

const SidebarMenuDivider = React.createClass({
  render() {
    return <div className="sidebar-dropdown-menu-divider" />;
  }
});

const SidebarMenuItem = React.createClass({
  getInitialState() {
    return {
      hover: false
    };
  },

  handleMouseOver() {
    if (this.mouseOutTimer) {
      window.clearTimeout(this.mouseOutTimer);
    }

    this.setState({hover: true});
  },

  handleMouseOut() {
    // Need some time for mouse to move to subMenu
    this.mouseOutTimer = window.setTimeout(() => this.setState({hover: false}), 350);
  },

  render() {
    let {href, subMenu, children} = this.props;
    let caret = !!subMenu;
    let shouldShowSubMenu = this.state.hover;
    let cx = 'sidebar-dropdown-menu-item';
    // let Container = !!href ? <a href={href} className={cx} /> : <span className={cx} />;
    let Container = !!href ? 'a' : 'span';

    return (
      <Container
        href={href}
        className={cx}
        onMouseOver={this.handleMouseOver}
        onMouseOut={this.handleMouseOut}>
        <span className="sidebar-dropdown-menu-item-label">{children}</span>
        {caret &&
          <span className="sidebar-dropdown-menu-item-caret">
            <i className="icon-arrow-right" />
          </span>}
        {!!subMenu && shouldShowSubMenu && subMenu}
      </Container>
    );
  }
});

const SidebarDropdownPopup = React.createClass({
  contextTypes: {
    location: React.PropTypes.object
  },

  componentDidMount() {
    document.addEventListener('click', this.handleGlobalClick);
  },

  componentWillUnmount() {
    document.removeEventListener('click', this.handleGlobalClick);
  },

  handleGlobalClick(e) {
    // Check if click is inside of side bar menu, otherwise we want to hide
    if (!this.menu) return;
    if (this.menu.contains(e.target)) return;
    if (typeof this.props.onHide !== 'function') return;
    this.props.onHide();
  },

  render() {
    const org = this.props.org;
    let user = ConfigStore.get('user');
    let to = url => (this.context.location ? {to: url} : {href: url});

    return (
      <div ref={ref => (this.menu = ref)} className="sidebar-dropdown-menu">
        <OrgSummary org={org} />
        <SidebarMenuItem href={`/organizations/${org.slug}/settings/`}>
          {t('Organization settings')}
        </SidebarMenuItem>
        <SidebarMenuItem href={`/organizations/${org.slug}/teams/`}>
          {t('Projects')}
        </SidebarMenuItem>
        <SidebarMenuItem href={`/organizations/${org.slug}/members/`}>
          {t('Members')}
        </SidebarMenuItem>
        <SidebarMenuItem href={`/organizations/${org.slug}/billing/`}>
          {t('Usage & Billing')}
        </SidebarMenuItem>
        <SidebarMenuItem
          subMenu={
            <div className="sidebar-dropdown-menu sidebar-dropdown-org-list">
              <SidebarMenuItem {...to('/${org.slug}/')}>
                <OrgSummary org={org} />
              </SidebarMenuItem>
              <SidebarMenuItem><OrgSummary org={org} /></SidebarMenuItem>
              <SidebarMenuItem><OrgSummary org={org} /></SidebarMenuItem>
              <SidebarMenuDivider />
              <SidebarMenuItem href={'/organizations/new/'}>
                {t('Create a new organization...')}
              </SidebarMenuItem>
            </div>
          }>
          {t('Switch organization')}
        </SidebarMenuItem>
        <SidebarMenuDivider />
        <UserSummary user={user} />
        <div className="sidebar-dropdown-user-items">
          <SidebarMenuItem href="/account/settings/">
            {t('User settings')}
          </SidebarMenuItem>
          <SidebarMenuItem {...to('/api/')}>{t('API keys')}</SidebarMenuItem>
          {user.isSuperuser &&
            <SidebarMenuItem {...to('/manage/')}>{t('Admin')}</SidebarMenuItem>}
          <SidebarMenuItem href="/auth/logout/">{t('Sign out')}</SidebarMenuItem>
        </div>
      </div>
    );
  }
});

const SidebarDropdown = React.createClass({
  getInitialState: function() {
    return {
      isOpen: false
    };
  },

  componentDidMount() {
    document.addEventListener('click', this.handleGlobalClick);
  },

  componentWillUnmount() {
    document.removeEventListener('click', this.handleGlobalClick);
  },

  handleHidePopup(e) {
    this.setState({isOpen: false});
  },

  toggleDropdown() {
    this.setState({isOpen: !this.state.isOpen});
  },

  render() {
    const org = this.props.org;
    let user = ConfigStore.get('user');

    return (
      <div className="sidebar-dropdown">
        <div className="sidebar-dropdown-toggle" onClick={() => this.toggleDropdown()}>
          {this.props.collapsed && <div className="org-avatar" />}
          {!this.props.collapsed &&
            <div>
              <div className="sidebar-dropdown-org-name">
                {org.name} <i className="icon-arrow-down" />
              </div>
              <div className="sidebar-dropdown-user-name">{user.name}</div>
            </div>}
        </div>
        {this.state.isOpen &&
          <SidebarDropdownPopup onHide={this.handleHidePopup} org={org} />}
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

    let initialSidebarState = Cookies.get('sidebar_collapsed');

    if (initialSidebarState == true) {
      this.setState({
        collapsed: true
      });
      jQuery(document.body).addClass('collapsed');
    }
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

  handleDoubleClick(e) {
    if ($(e.target).is('.sidebar')) {
      this.toggleSidebar();
    }
  },

  toggleSidebar() {
    this.setState({
      collapsed: !this.state.collapsed
    });
    if (!this.state.collapsed) {
      Cookies.set('sidebar_collapsed', 1);
      jQuery(document.body).addClass('collapsed');
    } else {
      jQuery(document.body).removeClass('collapsed');
      Cookies.set('sidebar_collapsed', 0);
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
      <div
        className={classNames}
        ref="sidebar"
        onDoubleClick={e => this.handleDoubleClick(e)}>
        <div className="sidebar-top">
          <SidebarSection style={{height: 36}}>
            <SidebarDropdown collapsed={this.state.collapsed} org={org} />
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
            <Incidents
              showPanel={this.state.showPanel}
              currentPanel={this.state.currentPanel}
              onShowPanel={() => this.togglePanel('statusupdate')}
              hidePanel={() => this.hidePanel()}
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
