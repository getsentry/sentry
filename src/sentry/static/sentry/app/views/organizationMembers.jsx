import React from "react";
import api from "../api";
import Gravatar from "../components/gravatar";
import LoadingError from "../components/loadingError";
import LoadingIndicator from "../components/loadingIndicator";
import OrganizationHomeContainer from "../components/organizationHomeContainer";
import OrganizationState from "../mixins/organizationState";
import RouteMixin from "../mixins/routeMixin";

var OrganizationMembers = React.createClass({
  mixins: [
    OrganizationState,
    RouteMixin
  ],

  contextTypes: {
    router: React.PropTypes.func
  },

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
    var router = this.context.router;
    if (nextParams.orgId != router.getCurrentParams().orgId) {
      this.fetchData();
    }
  },

  fetchData() {
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
    var params = this.getCurrentParams();
    return '/organizations/' + params.orgId + '/members/';
  },

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    return (
      <OrganizationHomeContainer>
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
      </OrganizationHomeContainer>
    );
  }
});

export default OrganizationMembers;
