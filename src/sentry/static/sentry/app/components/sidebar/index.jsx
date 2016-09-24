import React from 'react';
import Reflux from 'reflux';
import $ from 'jquery';

import ApiMixin from '../../mixins/apiMixin';
import ConfigStore from '../../stores/configStore';
import IncidentStore from '../../stores/incidentStore';
import OrganizationState from '../../mixins/organizationState';
import {load as loadIncidents} from '../../actionCreators/incidents';

import Broadcasts from './broadcasts';
import UserNav from './userNav';
import requiredAdminActions from '../requiredAdminActions';
import OrganizationSelector from './organizationSelector';
import SidebarPanel from '../sidebarPanel';
import TodoList from '../todos';
import IssueList from '../issueList';

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
  mixins: [
    ApiMixin,
    OrganizationState,
    Reflux.listenTo(IncidentStore, 'onIncidentChange'),
  ],

  getInitialState: function() {
    return {
      showTodos: location.hash === '#welcome',
      status: null
    };
  },

  componentDidMount() {
    $(window).on('hashchange', this.hashChangeHandler);
    $(document).on('click', this.documentClickHandler);

    loadIncidents();
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

  onIncidentChange(status) {
    this.setState({
      status: {...status}
    });
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

    if (!org) {
      // When no organization, just render Sentry logo at top
      return (
        <ul className="navbar-nav">
          <li><a className="logo" href="/"><span className="icon-sentry-logo"/></a></li>
        </ul>
      );
    }

    let status = this.state.status;

    return (<div>
      <OrganizationSelector
        organization={org}
        showPanel={this.state.showPanel}
        currentPanel={this.state.currentPanel}
        onShowPanel={()=>this.showPanel('org-selector')}
        hidePanel={()=>this.hidePanel()}/>

      {/* Top nav links */}
      <ul className="navbar-nav divider-bottom">
        <li className={this.state.currentPanel == 'assigned' ? 'active' : null }>
          <a>
            <span className="icon icon-user" onClick={()=>this.togglePanel('assigned')} />
          </a>
        </li>
        <li className={this.state.currentPanel == 'bookmarks' ? 'active' : null }>
          <a>
            <span className="icon icon-star-solid" onClick={()=>this.togglePanel('bookmarks')} />
          </a>
        </li>
        <li className={this.state.currentPanel == 'history' ? 'active' : null }>
          <a>
            <span className="icon icon-av_timer" onClick={()=>this.togglePanel('history')} />
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
      {this.state.showPanel && this.state.currentPanel == 'statusupdate' && status &&
        <SidebarPanel title={t('Recent status updates')}
                      hidePanel={()=>this.hidePanel()}>
          <ul className="incident-list list-unstyled">
            {status.incidents.map((incident) =>
              <li className="incident-item" key={incident.id}>
                <h4>{incident.title}</h4>
                {incident.updates ?
                  <div>
                    <h6>Latest updates:</h6>
                    <ul className="status-list list-unstyled">
                      {incident.updates.map((update, key) =>
                        <li className="status-item" key={key}>
                          <p>{update}</p>
                        </li>
                      )}
                    </ul>
                  </div>
                  :
                  null
                }
                <p>
                  <a href={incident.url} className="btn btn-default btn-sm">Learn more</a>
                </p>
              </li>
            )}
          </ul>
        </SidebarPanel>
      }
    </div>);
  },

  render() {
    let user = ConfigStore.get('user');
    let org = this.getOrganization();
    let logo;

    if (user) {
      logo = <span className="icon-sentry-logo"/>;
    } else {
      logo = <span className="icon-sentry-logo-full"/>;
    }

    let requiredAction = org && getFirstRequiredAdminAction(org);

    if (org && requiredAction !== null) {
      let slugId = requiredAction.ID.toLowerCase().replace(/_/g, '-');
      let url = `/organizations/${org.slug}/actions/${slugId}/`;
      actionMessage = (
        <a href={url}>{t('Required Action:')}{' '}{
          requiredAction.getActionLinkTitle()}</a>
      );
    }

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
            <Broadcasts
              showPanel={this.state.showPanel}
              currentPanel={this.state.currentPanel}
              onShowPanel={()=>this.togglePanel('broadcasts')}
              hidePanel={()=>this.hidePanel()} />

            {this.state.status &&
              <li className={this.state.currentPanel == 'statusupdate' ? 'active' : null }>
                <a onClick={()=>this.togglePanel('statusupdate')}><span className="icon icon-alert"/></a>
              </li>
            }
            <li>
              <UserNav className="user-settings" />
            </li>
          </ul>
        </div>

        { /* {org.slug ?
          <Link to={`/${org.slug}/`} className="logo">{logo}</Link>
          :
          <a href="/" className="logo">{logo}</a>
        */}
        { /* <OrganizationSelector
          organization={org}
          showPanel={this.state.showPanel}
          currentPanel={this.state.currentPanel}
          onShowPanel={()=>this.showPanel('broadcasts')}
          hidePanel={()=>this.hidePanel()}/> */ }

        { /* <StatusPage className="pull-right" /> */}
        { /*  {actionMessage ?
        <span className="admin-action-message">{actionMessage}</span>
        : null}
        */ }
      </nav>
    );
  }
});

export default Sidebar;
