import React from 'react';
import $ from 'jquery';

import ApiMixin from '../../mixins/apiMixin';
import OrganizationState from '../../mixins/organizationState';
import {load as loadIncidents} from '../../actionCreators/incidents';

import Broadcasts from './broadcasts';
import Incidents from './incidents';
import UserNav from './userNav';
import requiredAdminActions from '../requiredAdminActions';
import OrganizationSelector from './organizationSelector';
import SidebarPanel from '../sidebarPanel';
import TodoList from '../todos';
import IssueList from '../issueList';
import ConfigStore from '../../stores/configStore';

import {t} from '../../locale';

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
    if (org.features.indexOf('onboarding') === -1)
      return null;

    let percentage = Math.round(
      ((org.onboardingTasks || []).filter(
        task => task.status === 'complete' || task.status === 'skipped'
      ).length) / TodoList.TASKS.length * 100
    ).toString();
    let style = {
      height: percentage + '%',
    };

    return (
      <li className={this.props.currentPanel == 'todos' ? 'onboarding active' : 'onboarding' }>
        <div className="onboarding-progress-bar" onClick={this.props.onShowPanel}>
          <div className="slider" style={style} />
        </div>
        {this.props.showPanel && this.props.currentPanel == 'todos' &&
          <SidebarPanel
            title="Getting Started with Sentry"
            hidePanel={this.props.hidePanel}>
            <TodoList />
          </SidebarPanel>
        }
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

const Sidebar = React.createClass({
  contextTypes: {
    location: React.PropTypes.object
  },

  mixins: [
    ApiMixin,
    OrganizationState,
  ],

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
    if (this.state.currentPanel === panel)
      this.hidePanel();
    else
      this.showPanel(panel);
  },

  renderBody() {
    let org = this.getOrganization();
    let config = ConfigStore.getConfig();

    if (!org) {
      // When no organization, just render Sentry logo at top
      return (
        <ul className="navbar-nav">
          <li><a className="logo" href="/"><span className="icon-sentry-logo"/></a></li>
        </ul>
      );
    }

    return (<div>
      <OrganizationSelector
        organization={org}
        showPanel={this.state.showPanel}
        currentPanel={this.state.currentPanel}
        togglePanel={()=>this.togglePanel('org-selector')}
        hidePanel={()=>this.hidePanel()}/>

      {/* Top nav links */}
      <ul className="navbar-nav divider-bottom">
        <li className={this.state.currentPanel == 'assigned' ? 'active' : null }>
          <a title="Assigned to me">
            <span className="icon icon-user" onClick={()=>this.togglePanel('assigned')} />
          </a>
        </li>
        <li className={this.state.currentPanel == 'bookmarks' ? 'active' : null }>
          <a title="My Bookmarks">
            <span className="icon icon-star-solid" onClick={()=>this.togglePanel('bookmarks')} />
          </a>
        </li>
        <li className={this.state.currentPanel == 'history' ? 'active' : null }>
          <a title="Recently Viewed">
            <span className="icon icon-av_timer" onClick={()=>this.togglePanel('history')} />
          </a>
        </li>
      </ul>
      <ul className="navbar-nav">
        <Broadcasts
          showPanel={this.state.showPanel}
          currentPanel={this.state.currentPanel}
          onShowPanel={()=>this.togglePanel('broadcasts')}
          hidePanel={()=>this.hidePanel()} />
        <Incidents
          showPanel={this.state.showPanel}
          currentPanel={this.state.currentPanel}
          onShowPanel={()=>this.togglePanel('statusupdate')}
          hidePanel={()=>this.hidePanel()} />
        <li>
          <a title="Support" href={!config.isOnPremise ? `/organizations/${org.slug}/support/` : 'https://forum.sentry.io/'}>
            <span className="icon icon-support" />
          </a>
        </li>
      </ul>

      {/* Panel bodies */}
      {this.state.showPanel && this.state.currentPanel == 'assigned' &&
        <SidebarPanel title={t('Assigned to me')}
                      hidePanel={()=>this.hidePanel()}>
          <IssueList
            endpoint={`/organizations/${org.slug}/members/me/issues/assigned/`}
            query={{
              statsPeriod: '24h',
              per_page: 10,
              status: 'unresolved',
            }}
            pagination={false}
            renderEmpty={() => <div className="sidebar-panel-empty" key="none">{t('No issues have been assigned to you.')}</div>}
            ref="issueList"
            showActions={false}
            params={{orgId: org.slug}} />
        </SidebarPanel>
      }
      {this.state.showPanel && this.state.currentPanel == 'bookmarks' &&
        <SidebarPanel title={t('My Bookmarks')}
                      hidePanel={()=>this.hidePanel()}>
          <IssueList
            endpoint={`/organizations/${org.slug}/members/me/issues/bookmarked/`}
            query={{
              statsPeriod: '24h',
              per_page: 10,
              status: 'unresolved',
            }}
            pagination={false}
            renderEmpty={() => <div className="sidebar-panel-empty" key="no">{t('You have no bookmarked issues.')}</div>}
            ref="issueList"
            showActions={false}
            params={{orgId: org.slug}} />
        </SidebarPanel>
      }
      {this.state.showPanel && this.state.currentPanel == 'history' &&
        <SidebarPanel title={t('Recently Viewed')}
                      hidePanel={()=>this.hidePanel()}>
          <IssueList
            endpoint={`/organizations/${org.slug}/members/me/issues/viewed/`}
            query={{
              statsPeriod: '24h',
              per_page: 10,
              status: 'unresolved',
            }}
            pagination={false}
            renderEmpty={() => <div className="sidebar-panel-empty" key="none">{t('No recently viewed issues.')}</div>}
            ref="issueList"
            showActions={false}
            params={{orgId: org.slug}} />
        </SidebarPanel>
      }
    </div>);
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
          <a href={url}>{t('Required Action:')}{' '}{
            requiredAction.getActionLinkTitle()}</a>
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
                onShowPanel={()=>this.togglePanel('todos')}
                hidePanel={()=>this.hidePanel()} />
            }

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

export default Sidebar;
