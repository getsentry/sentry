import React from 'react';
import {Link} from 'react-router';

import ActivityFeed from '../components/activity/feed';
import GroupStore from '../stores/groupStore';
import IssueList from '../components/issueList';
import OrganizationHomeContainer from '../components//organizations/homeContainer';
import {t} from '../locale';

const AssignedIssues = React.createClass({
  getEndpoint() {
    return `/organizations/${this.props.params.orgId}/members/me/issues/assigned/?`;
  },

  getViewMoreLink() {
    return `/organizations/${this.props.params.orgId}/issues/assigned/`;
  },

  render() {
    return (
      <div>
        <div className="pull-right">
          <Link className="btn btn-sm btn-default" to={this.getViewMoreLink()}>{t('View more')}</Link>
        </div>
        <h3>Assigned</h3>
        <IssueList endpoint={this.getEndpoint()} query={{
          statsPeriod: this.props.statsPeriod,
          per_page: this.props.pageSize,
          status: 'unresolved',
        }} pagination={false} {...this.props} />
      </div>
    );
  },
});

const NewIssues = React.createClass({
  getEndpoint() {
    return `/organizations/${this.props.params.orgId}/issues/new/`;
  },

  render() {
    return (
      <div>
        <h3>New</h3>
        <IssueList endpoint={this.getEndpoint()} query={{
          statsPeriod: this.props.statsPeriod,
          per_page: this.props.pageSize,
          status: 'unresolved',
        }} pagination={false} {...this.props} />
      </div>
    );
  },
});


const Activity = React.createClass({
  getEndpoint() {
    return `/organizations/${this.props.params.orgId}/activity/`;
  },

  render() {
    return (
      <div>
        <h6 className="nav-header">Activity</h6>
        <ActivityFeed endpoint={this.getEndpoint()} query={{
          per_page: 10,
        }} pagination={false} {...this.props} />
      </div>
    );
  },
});


const OrganizationDashboard = React.createClass({
  getDefaultProps() {
    return {
      statsPeriod: '24h',
      pageSize: 5,
    };
  },

  componentWillUnmount() {
    GroupStore.reset();
  },

  render() {
    return (
      <OrganizationHomeContainer>
        <div className="early-adopter-banner"><strong>Psst!</strong> This feature is still a work-in-progress. Thanks for being an early adopter! YO! YO!</div>
        <div className="row">
          <div className="col-md-8">
            <div className="onboarding-wrapper">
              <a href="#" className="close"><span className="icon-x"/></a>
              <h3>Remaining Todos</h3>
              <ul className="list-unstyled">
                <li className="checked">
                  <div className="ob-checkbox">
                    <span className="icon-checkmark"/>
                  </div>
                  <h4>Send your first event</h4>
                  <p>
                    View our <a href="#">installation instructions</a>
                  </p>
                </li>
                <li>
                  <div className="ob-checkbox"></div>
                  <h4>Invite team members</h4>
                  <p>
                    Learn about <a href="#">how access works</a> on Sentry
                  </p>
                </li>
                <li>
                  <div className="ob-checkbox"></div>
                  <h4>Teach Sentry about your project</h4>
                  <p>
                    Track users, releases, and other rich context  &middot; <a href="#">Learn More</a>
                  </p>
                </li>
                <li>
                  <div className="ob-checkbox"></div>
                  <h4>Add an issue tracker</h4>
                  <p>
                    Link Sentry Issues in Jira, GitHub, Trello, and others &middot; <a href="#">Learn More</a>
                  </p>
                </li>
                <li>
                  <div className="ob-checkbox"></div>
                  <h4>Setup notification services</h4>
                  <p>
                    Be notified of Issues via Slack, HipChat, and More &middot; <a href="#">Learn More</a>
                  </p>
                </li>
              </ul>
            </div>
            <AssignedIssues {...this.props} />
            <NewIssues {...this.props} />
          </div>
          <div className="col-md-4">
            <Activity {...this.props} />
          </div>
        </div>
      </OrganizationHomeContainer>
    );
  },
});

export default OrganizationDashboard;
