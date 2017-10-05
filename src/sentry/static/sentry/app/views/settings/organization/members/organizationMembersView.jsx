import {browserHistory} from 'react-router';
import React from 'react';

import {t, tct} from '../../../../locale';
import Button from '../../../../components/buttons/button';
import ConfigStore from '../../../../stores/configStore';
import IndicatorStore from '../../../../stores/indicatorStore';
import SentryTypes from '../../../../proptypes';
import SpreadLayout from '../../../../components/spreadLayout';
import OrganizationSettingsView from '../../../organizationSettingsView';
import OrganizationMemberRow from './organizationMemberRow';
import OrganizationAccessRequests from './organizationAccessRequests';

class OrganizationMembersView extends OrganizationSettingsView {
  static contextTypes = {
    organization: SentryTypes.Organization
  };

  // XXX(billy): setState causes re-render of the entire view...
  // we should not do this
  getDefaultState() {
    let state = super.getDefaultState();
    return {
      ...state,
      members: [],
      invited: new Map(),
      accessRequestBusy: new Map()
    };
  }

  getEndpoints() {
    return [
      ['members', `/organizations/${this.props.params.orgId}/members/`],
      ['authProvider', `/organizations/${this.props.params.orgId}/auth-provider/`],
      ['requestList', `/organizations/${this.props.params.orgId}/access-requests/`]
    ];
  }

  getTitle() {
    let org = this.context.organization;
    return `${org.name} Members`;
  }

  removeMember = id => {
    let {params} = this.props;
    let {orgId} = params || {};

    return new Promise((resolve, reject) => {
      this.api.request(`/organizations/${orgId}/members/${id}/`, {
        method: 'DELETE',
        data: {},
        success: data => {
          this.setState(state => ({
            members: state.members.filter(({id: existingId}) => existingId !== id)
          }));
          resolve(data);
        },
        error: err => reject(err)
      });
    });
  };

  approveOrDeny = (isApproved, id) => {
    let {params} = this.props;
    let {orgId} = params || {};

    this.setState(state => ({
      accessRequestBusy: state.accessRequestBusy.set(id, true)
    }));

    return new Promise((resolve, reject) => {
      this.api.request(`/organizations/${orgId}/access-requests/${id}/`, {
        method: 'PUT',
        data: {isApproved},
        success: data => {
          this.setState(state => ({
            requestList: state.requestList.filter(({id: existingId}) => existingId !== id)
          }));
          resolve(data);
        },
        error: err => reject(err),
        complete: () =>
          this.setState(state => ({
            accessRequestBusy: state.accessRequestBusy.set(id, false)
          }))
      });
    });
  };

  handleApprove = id => this.approveOrDeny(true, id);

  handleDeny = id => this.approveOrDeny(false, id);

  handleRemove = ({id, name}, e) => {
    let {organization} = this.context;
    let {orgName} = organization;

    this.removeMember(id).then(
      () =>
        IndicatorStore.add(
          tct('Removed [name] from [orgName]', {
            name,
            orgName
          }),
          'success'
        ),
      () =>
        IndicatorStore.add(
          tct('Error removing [name] from [orgName]', {
            name,
            orgName
          }),
          'error'
        )
    );
  };

  handleLeave = ({id}, e) => {
    let {organization} = this.context;
    let {orgName} = organization;

    this.removeMember(id).then(
      () =>
        IndicatorStore.add(
          tct('You left [orgName]', {
            orgName
          }),
          'success'
        ),
      () =>
        IndicatorStore.add(
          tct('Error leaving [orgName]', {
            orgName
          }),
          'error'
        )
    );
  };

  handleSendInvite = ({id}) => {
    this.setState(state => ({
      invited: state.invited.set(id, 'loading')
    }));

    this.api.request(`/organizations/${this.props.params.orgId}/members/${id}/`, {
      method: 'PUT',
      data: {reinvite: 1},
      success: data =>
        this.setState(state => ({
          invited: state.invited.set(id, 'success')
        })),
      error: () => {
        this.setState(state => ({
          invited: state.invited.set(id, null)
        }));
        IndicatorStore.add(t('Error sending invite'), 'error');
      }
    });
  };

  handleAddMember = () => {
    this.setState({
      busy: true
    });
    this.api.request(`/organizations/${this.props.params.orgId}/members/`, {
      method: 'POST',
      data: {},
      success: data => {
        this.setState({busy: false});
        browserHistory.push(
          `/organizations/${this.props.params.orgId}/members/${data.id}`
        );
      },
      error: () => {
        this.setState({busy: false});
      }
    });
  };

  renderBody() {
    let {params} = this.props;
    let {members, requestList} = this.state;
    let {organization} = this.context;
    let {orgId} = params || {};
    let {name: orgName, access} = organization;
    let canAddMembers = access.indexOf('org:write') > -1;
    let canRemove = access.indexOf('member:admin') > -1;
    let currentUser = ConfigStore.get('user');
    // Find out if current user is the only owner
    let isOnlyOwner = !members.find(
      ({role, email}) => role === 'owner' && email !== currentUser.email
    );
    // Only admins/owners can remove members
    let requireLink = !!this.state.authProvider && this.state.authProvider.require_link;

    return (
      <div>

        <SpreadLayout className="page-header">
          <h3>Members</h3>
          <Button
            priority="primary"
            size="small"
            className="pull-right"
            disabled={!canAddMembers}
            title={
              !canAddMembers
                ? t('You do not have enough permission to add new members')
                : undefined
            }
            to={`/organization/${orgId}/members/invite/`}>
            <span className="icon-plus" /> {t('Invite Member')}
          </Button>
        </SpreadLayout>

        <OrganizationAccessRequests
          onApprove={this.handleApprove}
          onDeny={this.handleDeny}
          accessRequestBusy={this.state.accessRequestBusy}
          requestList={requestList}
        />

        <div className="panel panel-default horizontal-scroll">
          <table className="table member-list">
            <colgroup>
              <col width="45%" />
              <col width="15%" />
              <col width="15%" />
              <col width="25%" />
            </colgroup>

            <thead>
              <tr>
                <th>{t('Member')}</th>
                <th>&nbsp;</th>
                <th className="squash">{t('Role')}</th>
                <th className="squash">&nbsp;</th>
              </tr>
            </thead>

            <tbody>
              {members.map(member => {
                return (
                  <OrganizationMemberRow
                    key={member.id}
                    member={member}
                    status={this.state.invited.get(member.id)}
                    orgId={orgId}
                    orgName={orgName}
                    memberCanLeave={!isOnlyOwner}
                    currentUser={currentUser}
                    canRemoveMembers={canRemove}
                    canAddMembers={canAddMembers}
                    requireLink={requireLink}
                    onSendInvite={this.handleSendInvite}
                    onRemove={this.handleRemove}
                    onLeave={this.handleLeave}
                  />
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    );
  }
}

export default OrganizationMembersView;
