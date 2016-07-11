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
import TodoList from '../todos';
import {t} from '../../locale';

const OnboardingStatus = React.createClass({
  propTypes: {
    org: React.PropTypes.object.isRequired,
    onToggleTodos: React.PropTypes.func.isRequired,
    showTodos: React.PropTypes.bool,
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
      <header>
        <div className="container">
          <div className="anchor-top">
            <div className="org-switcher divider-bottom">
              <a className="active-org">
                <img src="https://s3.amazonaws.com/f.cl.ly/items/0z1b103b2K2e3A0y3E0H/sentry-avatar.png" />
              </a>
            </div>
            <ul className="my-nav divider-bottom">
              <li><a><span className="icon-user"/></a></li>
              <li><a><span className="icon-star-solid"/></a></li>
              <li><a><span className="icon-av_timer"/></a></li>
            </ul>
            <div className="sidebar-panel">
              <div className="sidebar-panel-header">
                <a className="close"></a>
                <h2>Assigned to me</h2>
              </div>
              <div className="sidebar-panel-items">
                <div className="sidebar-panel-item">
                  <h3>Type Error <span className="culprit">poll(../../sentry/scripts/views.js)</span></h3>
                  <div className="message">Object [object Object] has no method 'updateFrom'</div>
                </div>
                <div className="sidebar-panel-item active">
                  <h3>Type Error <span className="culprit">poll(../../sentry/scripts/views.js)</span></h3>
                  <div className="message">Object [object Object] has no method 'updateFrom'</div>
                </div>
                <div className="sidebar-panel-item">
                  <h3>Type Error <span className="culprit">poll(../../sentry/scripts/views.js)</span></h3>
                  <div className="message">Object [object Object] has no method 'updateFrom'</div>
                </div>
                <div className="sidebar-panel-item">
                  <h3>Type Error <span className="culprit">poll(../../sentry/scripts/views.js)</span></h3>
                  <div className="message">Object [object Object] has no method 'updateFrom'</div>
                </div>
                <div className="sidebar-panel-item">
                  <h3>Type Error <span className="culprit">poll(../../sentry/scripts/views.js)</span></h3>
                  <div className="message">Object [object Object] has no method 'updateFrom'</div>
                </div>
              </div>
            </div>
          </div>
          { /* <Broadcasts /> */ }
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
          <div className="user-nav">
            {org &&
              <OnboardingStatus org={org} showTodos={this.state.showTodos}
                                onShowTodos={this.setState.bind(this, {showTodos: false})}
                                onToggleTodos={this.toggleTodos}
                                onHideTodos={this.setState.bind(this, {showTodos: false})} />
            }
            <div class="notification-hub-dropdown"></div>
            <div class="support"></div>
            <UserNav className="user-settings" />
          </div>
        </div>
      </header>
    );
  }
});

export default Header;
