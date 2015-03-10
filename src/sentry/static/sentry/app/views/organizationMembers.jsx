/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var api = require("../api");
var BreadcrumbMixin = require("../mixins/breadcrumbMixin");
var Gravatar = require("../components/gravatar");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var OrganizationState = require("../mixins/organizationState");
var RouteMixin = require("../mixins/routeMixin");

var OrganizationMembers = React.createClass({
  mixins: [
    BreadcrumbMixin,
    OrganizationState,
    RouteMixin,
    Router.State
  ],

  crumbReservations: 1,

  getInitialState() {
    return {
      loading: false,
      error: false,
      memberList: null
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  routeDidChange(nextPath, nextParams) {
    if (nextParams.orgId != this.getParams().orgId) {
      this.fetchData();
    }
  },

  fetchData() {
    this.setBreadcrumbs([
      {name: 'Members', to: 'organizationMembers'}
    ]);

    this.setState({
      loading: true,
      error: false
    });

    api.request(this.getOrganizationMembersEndpoint(), {
      success: (data) => {
        this.setState({
          memberList: data,
          loading: false
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  getOrganizationMembersEndpoint() {
    var params = this.getParams();
    return '/organizations/' + params.orgId + '/members/';
  },

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    return (
      <div>
        <h3>Members</h3>
        <p>Members of your organization gain slightly elevated permissions over individual team members. For example, organization administrators can create new teams as well as manage all organization settings (including the list of admins).</p>
        <br />
        <table className="table simple-list table-bordered member-list">
          <colgroup>
            <col width="30%"/>
            <col width="25%" />
            <col width="20%"/>
            <col width="20%"/>
            <col width="5%"/>
          </colgroup>
          <thead>
            <tr>
              <th>Member</th>
              <th>&nbsp;</th>
              <th>Role</th>
              <th>Teams</th>
              <th className="squash">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {this.state.memberList.map((member) => {
              return (
                <tr>
                  <td className="user-info">
                    <Gravatar email={member.email} size={80} className="avatar" />
                    <strong><a href="#">{member.name}</a></strong>
                    <br />
                    <small>{member.email}</small>
                    <br />
                  </td>
                  <td className="status">
                    <strong>Missing SSO Link</strong>
                    <a className="resend-invite btn btn-small btn-primary">Resend invite</a>
                  </td>
                  <td>{member.roleName}</td>
                  <td>
                    <span className="tip" title="Access to all teams">&infin;</span>
                  </td>
                  <td className="align-right squash">
                    <a className="btn btn-default btn-sm remove-member">
                      <span className="icon icon-trash"></span> Remove
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
});

module.exports = OrganizationMembers;
