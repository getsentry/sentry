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

const OnboardingStatus = React.createClass({
  propTypes: {
    org: React.PropTypes.object.isRequired,
    onToggleTodos: React.PropTypes.func.isRequired,
    showTodos: React.PropTypes.bool,
    showPanel: React.PropTypes.bool,
    onHideTodos: React.PropTypes.func,
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
      <div className="onboarding-progress-bar" onClick={this.props.onToggleTodos}>
        <div className="slider" style={style} ></div>
        {this.props.showTodos &&
          <div className="dropdown-menu"><TodoList onClose={this.props.onHideTodos} /></div>
        }
      </div>
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
  },

  showPanel(panel) {
    this.setState({
      showPanel: true,
      currentPanel: panel
    });
    console.log(this.state.currentPanel);
    console.log(this.state.showPanel);
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

    // NOTE: this.props.orgId not guaranteed to be specified
    return (
      <nav className="navbar">
        <div className="container">
          <div className="anchor-top">
            <div className="org-switcher divider-bottom">
              <a className="active-org" href="/">
                <img src="https://s3.amazonaws.com/f.cl.ly/items/0z1b103b2K2e3A0y3E0H/sentry-avatar.png" />
              </a>
            </div>
            <ul className="navbar-nav divider-bottom">
              <li className={this.state.currentPanel == 'assigned' ? 'active' : null }>
                <a><span className="icon-user" onClick={()=>this.showPanel('assigned')} /></a>
              </li>
              <li className={this.state.currentPanel == 'bookmarks' ? 'active' : null }>
                <a><span className="icon-star-solid" onClick={()=>this.showPanel('bookmarks')} /></a>
              </li>
              <li className={this.state.currentPanel == 'history' ? 'active' : null }>
                <a><span className="icon-av_timer" onClick={()=>this.showPanel('history')} /></a>
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
            {this.state.showPanel && this.state.currentPanel == 'onboarding' &&
                <SidebarPanel title={t('Getting Started')}
                              hidePanel={()=>this.hidePanel()}/>
            }
          </div>

          <ul className="navbar-nav anchor-bottom">

            {org &&
              <li>
                <OnboardingStatus org={org} showTodos={this.state.showTodos}
                                onShowTodos={this.setState.bind(this, {showTodos: false})}
                                onToggleTodos={this.toggleTodos}
                                onHideTodos={this.setState.bind(this, {showTodos: false})} />
              </li>
            }
            <Broadcasts showPanel={this.state.showPanel}
                        currentPanel={this.state.currentPanel}
                        onShowPanel={()=>this.showPanel('broadcasts')}
                        hidePanel={()=>this.hidePanel()} />
            <li><UserNav className="user-settings" /></li>
          </ul>



          { /* {this.props.orgId ?
            <Link to={`/${this.props.orgId}/`} className="logo">{logo}</Link>
            :
            <a href="/" className="logo">{logo}</a>
          */}
          { /* <OrganizationSelector organization={org} /> */ }

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
