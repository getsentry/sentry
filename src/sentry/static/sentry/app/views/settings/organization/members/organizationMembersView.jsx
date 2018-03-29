import {Box} from 'grid-emotion';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';

import {t, tct} from '../../../../locale';
import Button from '../../../../components/buttons/button';
import ConfigStore from '../../../../stores/configStore';
import IndicatorStore from '../../../../stores/indicatorStore';
import OrganizationAccessRequests from './organizationAccessRequests';
import OrganizationMemberRow from './organizationMemberRow';
import OrganizationSettingsView from '../../../organizationSettingsView';
import Pagination from '../../../../components/pagination';
import {Panel, PanelBody, PanelHeader} from '../../../../components/panels';
import SentryTypes from '../../../../proptypes';
import SettingsPageHeader from '../../components/settingsPageHeader';
import recreateRoute from '../../../../utils/recreateRoute';
import GuideAnchor from '../../../../components/assistant/guideAnchor';

class OrganizationMembersView extends OrganizationSettingsView {
  static propTypes = {
    routes: PropTypes.array,
  };

  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  // XXX(billy): setState causes re-render of the entire view...
  // we should not do this
  getDefaultState() {
    let state = super.getDefaultState();
    return {
      ...state,
      members: [],
      invited: new Map(),
      accessRequestBusy: new Map(),
    };
  }

  getEndpoints() {
    return [
      [
        'members',
        `/organizations/${this.props.params.orgId}/members/`,
        {},
        {paginate: true},
      ],
      [
        'authProvider',
        `/organizations/${this.props.params.orgId}/auth-provider/`,
        {},
        {
          allowError: error => {
            // Allow for 403s
            return error.status === 403;
          },
        },
      ],
      ['requestList', `/organizations/${this.props.params.orgId}/access-requests/`],
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
            members: state.members.filter(({id: existingId}) => existingId !== id),
          }));
          resolve(data);
        },
        error: err => reject(err),
      });
    });
  };

  approveOrDeny = (isApproved, id) => {
    let {params} = this.props;
    let {orgId} = params || {};

    this.setState(state => ({
      accessRequestBusy: state.accessRequestBusy.set(id, true),
    }));

    return new Promise((resolve, reject) => {
      this.api.request(`/organizations/${orgId}/access-requests/${id}/`, {
        method: 'PUT',
        data: {isApproved},
        success: data => {
          this.setState(state => ({
            requestList: state.requestList.filter(
              ({id: existingId}) => existingId !== id
            ),
          }));
          resolve(data);
        },
        error: err => reject(err),
        complete: () =>
          this.setState(state => ({
            accessRequestBusy: state.accessRequestBusy.set(id, false),
          })),
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
            orgName,
          }),
          'success'
        ),
      () =>
        IndicatorStore.add(
          tct('Error removing [name] from [orgName]', {
            name,
            orgName,
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
            orgName,
          }),
          'success'
        ),
      () =>
        IndicatorStore.add(
          tct('Error leaving [orgName]', {
            orgName,
          }),
          'error'
        )
    );
  };

  handleSendInvite = ({id}) => {
    this.setState(state => ({
      invited: state.invited.set(id, 'loading'),
    }));

    this.api.request(`/organizations/${this.props.params.orgId}/members/${id}/`, {
      method: 'PUT',
      data: {reinvite: 1},
      success: data =>
        this.setState(state => ({
          invited: state.invited.set(id, 'success'),
        })),
      error: () => {
        this.setState(state => ({
          invited: state.invited.set(id, null),
        }));
        IndicatorStore.add(t('Error sending invite'), 'error');
      },
    });
  };

  handleAddMember = () => {
    this.setState({
      busy: true,
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
      },
    });
  };

  renderBody() {
    let {params, routes} = this.props;
    let {membersPageLinks, members, requestList} = this.state;
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

    let action = (
      <Button
        priority="primary"
        size="small"
        disabled={!canAddMembers}
        title={
          !canAddMembers
            ? t('You do not have enough permission to add new members')
            : undefined
        }
        to={recreateRoute('new', {routes, params})}
        icon="icon-circle-add"
      >
        {t('Invite Member')}
      </Button>
    );

    if (canAddMembers)
      action = (
        <GuideAnchor target="member_add" type="invisible">
          {action}
        </GuideAnchor>
      );

    return (
      <div>
        <SettingsPageHeader title="Members" action={action} />

        <OrganizationAccessRequests
          onApprove={this.handleApprove}
          onDeny={this.handleDeny}
          accessRequestBusy={this.state.accessRequestBusy}
          requestList={requestList}
        />

        <Panel>
          <PanelHeader disablePadding>
            <Box px={2} flex="1">
              {t('Member')}
            </Box>
            <GuideAnchor target="member_status" type="text">
              <Box px={2} w={180}>
                {t('Status')}
              </Box>
            </GuideAnchor>
            <GuideAnchor target="member_role" type="text">
              <Box px={2} w={140}>
                {t('Role')}
              </Box>
            </GuideAnchor>
            <Box px={2} w={140}>
              {t('Actions')}
            </Box>
          </PanelHeader>

          <PanelBody>
            {members.map(member => {
              return (
                <OrganizationMemberRow
                  routes={routes}
                  params={params}
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
          </PanelBody>
        </Panel>

        <Pagination pageLinks={membersPageLinks} />
      </div>
    );
  }
}

export default OrganizationMembersView;
