import React from 'react';
import {Link} from 'react-router';

import ActivityFeed from '../components/activity/feed';
import GroupStore from '../stores/groupStore';
import IssueList from '../components/issueList';
import OrganizationHomeContainer from '../components//organizations/homeContainer';

const AssignedIssues = React.createClass({
  getEndpoint() {
    return `/organizations/${this.props.params.orgId}/members/me/issues/assigned/`;
  },

  getViewMoreLink() {
    return `/organizations/${this.props.params.orgId}/issues/assigned/`;
  },

  render() {
    return (
      <div>
        <div className="pull-right">
          <Link className="btn btn-sm btn-default" to={this.getViewMoreLink()}>View more</Link>
        </div>
        <h3>Assigned</h3>
        <IssueList endpoint={this.getEndpoint()} query={{
          statsPeriod: this.props.statsPeriod,
          per_page: this.props.pageSize,
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
          per_page: 20,
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
        <div className="alert alert-block alert-info hidden">Psst! This feature is still a work-in-progress. Thanks for being an early adopter!</div>
        <div className="row">
          <div className="col-md-9">
            <AssignedIssues {...this.props} />
            <NewIssues {...this.props} />
          </div>
          <div className="col-md-3">
            <Activity {...this.props} />
          </div>
        </div>
      </OrganizationHomeContainer>
    );
  },
});

export default OrganizationDashboard;
