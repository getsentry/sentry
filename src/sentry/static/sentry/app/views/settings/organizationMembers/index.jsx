import PropTypes from 'prop-types';
import React from 'react';
import {debounce} from 'lodash';
import idx from 'idx';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/buttons/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ConfigStore from 'app/stores/configStore';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import Input from 'app/views/settings/components/forms/controls/input';
import Pagination from 'app/components/pagination';
import SentryTypes from 'app/proptypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import recreateRoute from 'app/utils/recreateRoute';

import OrganizationAccessRequests from './organizationAccessRequests';
import OrganizationMemberRow from './organizationMemberRow';

class OrganizationMembersView extends AsyncView {
  static propTypes = {
    routes: PropTypes.array,
  };

  static contextTypes = {
    router: PropTypes.object.isRequired,
    organization: SentryTypes.Organization,
  };

  componentWillReceiveProps(nextProps, nextContext) {
    super.componentWillReceiveProps(nextProps, nextContext);
    let searchQuery = idx(nextProps, _ => _.location.query.query);
    if (searchQuery !== idx(this.props, _ => _.location.query.query)) {
      this.setState({searchQuery});
    }
  }

  // XXX(billy): setState causes re-render of the entire view...
  // we should not do this
  getDefaultState() {
    let state = super.getDefaultState();
    return {
      ...state,
      members: [],
      invited: new Map(),
      accessRequestBusy: new Map(),
      searchQuery: idx(this.props, _ => _.location.query.query) || '',
    };
  }

  getEndpoints() {
    return [
      [
        'members',
        `/organizations/${this.props.params.orgId}/members/`,
        {
          query: {
            query: idx(this.props, _ => _.location.query.query),
          },
        },
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

  handleSearch = e => {
    let {router} = this.context;
    let {location} = this.props;
    e.preventDefault();
    router.push({
      pathname: location.pathname,
      query: {
        query: this.state.searchQuery,
      },
    });
  };

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
    let {slug: orgName} = organization;

    this.removeMember(id).then(
      () =>
        addSuccessMessage(
          tct('Removed [name] from [orgName]', {
            name,
            orgName,
          })
        ),
      () =>
        addErrorMessage(
          tct('Error removing [name] from [orgName]', {
            name,
            orgName,
          })
        )
    );
  };

  handleLeave = ({id}, e) => {
    let {organization} = this.context;
    let {slug: orgName} = organization;

    this.removeMember(id).then(
      () =>
        addSuccessMessage(
          tct('You left [orgName]', {
            orgName,
          })
        ),
      () =>
        addErrorMessage(
          tct('Error leaving [orgName]', {
            orgName,
          })
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
        addErrorMessage(t('Error sending invite'));
      },
    });
  };

  handleChange = evt => {
    let searchQuery = evt.target.value;
    this.getMembers(searchQuery);
    this.setState({searchQuery});
  };

  getMembers = debounce(searchQuery => {
    let {params} = this.props;
    let {orgId} = params || {};

    this.api.request(`/organizations/${orgId}/members/?query=${searchQuery}`, {
      method: 'GET',
      success: (data, _, jqXHR) => {
        this.handleRequestSuccess({stateKey: 'members', data, jqXHR});
      },
    });
  }, 200);

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
        to={recreateRoute('new/', {routes, params})}
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
          <PanelHeader hasButtons>
            {t('Member')}
            <form onSubmit={this.handleSearch}>
              <Input
                value={this.state.searchQuery}
                onChange={this.handleChange}
                className="search"
                placeholder={t('Search Members')}
              />
            </form>
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
                  firstRow={members.indexOf(member) === 0}
                />
              );
            })}
            {members.length === 0 && (
              <EmptyMessage>{t('No members found.')}</EmptyMessage>
            )}
          </PanelBody>
        </Panel>

        <Pagination pageLinks={membersPageLinks} />
      </div>
    );
  }
}

export default OrganizationMembersView;
