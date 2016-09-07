import React from 'react';
import $ from 'jquery';

import ApiMixin from '../../mixins/apiMixin';
import ConfigStore from '../../stores/configStore';
import OrganizationState from '../../mixins/organizationState';
import {Link} from 'react-router';

import Broadcasts from './broadcasts';
import StatusPage from './statuspage';
import UserNav from './userNav';
import requiredAdminActions from '../requiredAdminActions';
import OrganizationSelector from './organizationSelector';
import SidebarPanel from '../sidebarPanel';
import TodoList from '../todos';
import {t} from '../../locale';

const INCIDENTS = [
  {
    id: 1,
    title: "Issues delivering mail to FastMail customers",
    url: "http://example.com",
    updates: [
        {
          id: 1,
          status: "Resolved",
          message: "FastMail has addressed the issue, and we are delivering email again.",
          timestamp : "1 hour ago"
        },
        {
          id: 2,
          status: "Identified",
          message: "FastMail customers are not getting emails. Our outbound IPs are being rate limited by FastMail. We have an open ticket with them to try and alleviate the issue. In the meantime, you may want to switch your Sentry email to something not backed by FastMail.",
          timestamp : "2 hours ago",
        }
    ]
  }
];

const OnboardingStatus = React.createClass({
  propTypes: {
    org: React.PropTypes.object.isRequired
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

const Header = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string
  },

  mixins: [ApiMixin, OrganizationState],

  getInitialState: function() {
    if (location.hash == '#welcome') {
      return {showTodos: true};
    } else {
      return {showTodos: false};
    }
  },

  componentDidMount() {
    $(window).on('hashchange', this.hashChangeHandler);
  },

  componentWillUnmount() {
    $(window).off('hashchange', this.hashChangeHandler);
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
      currentPanel: ""
    });
    console.log("Panel Hidden.");
  },

  showPanel(panel) {
    this.setState({
      showPanel: true,
      currentPanel: panel
    });
    // console.log(this.state.showPanel);
    // console.log(this.state.currentPanel);
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
    let actionMessage = null;

    if (org && requiredAction !== null) {
      let slugId = requiredAction.ID.toLowerCase().replace(/_/g, '-');
      let url = `/organizations/${org.slug}/actions/${slugId}/`;
      actionMessage = (
        <a href={url}>{t('Required Action:')}{' '}{
          requiredAction.getActionLinkTitle()}</a>
      );
    }

    let incidents = INCIDENTS;

    // NOTE: this.props.orgId not guaranteed to be specified
    return (
      <nav className="navbar">
        <div className="container">
          <div className="anchor-top">
            {org &&
              <OrganizationSelector
                organization={org}
                showPanel={this.state.showPanel}
                currentPanel={this.state.currentPanel}
                onShowPanel={()=>this.showPanel('org-selector')}
                hidePanel={()=>this.hidePanel()}/>
            }
            <ul className="navbar-nav divider-bottom">
              <li className={this.state.currentPanel == 'assigned' ? 'active' : null }>
                <a>
                  <span className="icon-user" onClick={()=>this.showPanel('assigned')} />
                  <span className="activity-indicator" />
                </a>
              </li>
              <li className={this.state.currentPanel == 'bookmarks' ? 'active' : null }>
                <a>
                  <span className="icon-star-solid" onClick={()=>this.showPanel('bookmarks')} />
                  <span className="activity-indicator" />
                </a>
              </li>
              <li className={this.state.currentPanel == 'history' ? 'active' : null }>
                <a>
                  <span className="icon-av_timer" onClick={()=>this.showPanel('history')} />
                  <span className="activity-indicator" />
                </a>
              </li>
            </ul>
            {this.state.showPanel && this.state.currentPanel == 'assigned' &&
                <SidebarPanel title={t('Assigned to me')}
                              hidePanel={()=>this.hidePanel()}/>
            }
            {this.state.showPanel && this.state.currentPanel == 'bookmarks' &&
                <SidebarPanel title={t('My Bookmarks')}
                              hidePanel={()=>this.hidePanel()}/>
            }
            {this.state.showPanel && this.state.currentPanel == 'history' &&
                <SidebarPanel title={t('Recently Viewed')}
                              hidePanel={()=>this.hidePanel()}/>
            }
            {this.state.showPanel && this.state.currentPanel == 'statusupdate' &&
                <SidebarPanel title={t('Active Incidents')}
                              hidePanel={()=>this.hidePanel()}>
                  <ul className="incident-list list-unstyled">
                    {incidents.map((incident) =>
                      <li className="incident-item">
                        <h4>{incident.title}</h4>
                        {incident.updates ?
                          <div>
                            <h6>Latest updates:</h6>
                            <ul className="status-list list-unstyled">
                              {incident.updates.map((update) =>
                                <li className="status-item">
                                  <p>
                                    <strong>{update.status}</strong> - &nbsp;
                                    {update.message}<br/>
                                    <small>{update.timestamp}</small>
                                  </p>
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
          </div>

          <ul className="navbar-nav anchor-bottom">
            {org &&
              <OnboardingStatus
                org={org}
                showPanel={this.state.showPanel}
                currentPanel={this.state.currentPanel}
                onShowPanel={()=>this.showPanel('todos')}
                hidePanel={()=>this.hidePanel()} />
            }
            <Broadcasts
              showPanel={this.state.showPanel}
              currentPanel={this.state.currentPanel}
              onShowPanel={()=>this.showPanel('broadcasts')}
              hidePanel={()=>this.hidePanel()} />
            <li className={this.state.currentPanel == 'statusupdate' ? 'active' : null }>
              <a onClick={()=>this.showPanel('statusupdate')} ><span className="icon-alert" /></a>
            </li>
            <li>
              <UserNav className="user-settings" />
            </li>
          </ul>



          { /* {this.props.orgId ?
            <Link to={`/${this.props.orgId}/`} className="logo">{logo}</Link>
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
        </div>
      </nav>
    );
  }
});

export default Header;
