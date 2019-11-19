import React from 'react';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {Organization, Member} from 'app/types';
import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ConfigStore from 'app/stores/configStore';
import Pagination from 'app/components/pagination';
import routeTitleGen from 'app/utils/routeTitle';
import SentryTypes from 'app/sentryTypes';
import {redirectToRemainingOrganization} from 'app/actionCreators/organizations';
import withOrganization from 'app/utils/withOrganization';

import OrganizationMemberRow from './organizationMemberRow';

type Props = AsyncView['props'] & {
  organization: Organization;
};

type State = AsyncView['state'] & {
  members: Member[];
  invited: {[key: string]: 'loading' | 'success' | null};
};

class OrganizationMembersList extends AsyncView<Props, State> {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  get searchQuery() {
    const {location} = this.props;

    if (!location || !location.query.query) {
      return '';
    }

    if (Array.isArray(location.query.query)) {
      return location.query.query[0];
    }

    return location.query.query;
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      members: [],
      invited: {},
      searchQuery: this.searchQuery,
    };
  }

  getEndpoints(): [
    string,
    string,
    {query?: {query: string}},
    {paginate?: boolean; allowError?: (error: any) => boolean}
  ][] {
    const {orgId} = this.props.params;

    return [
      [
        'members',
        `/organizations/${orgId}/members/`,
        {
          query: {
            query: this.searchQuery,
          },
        },
        {paginate: true},
      ],
      [
        'authProvider',
        `/organizations/${orgId}/auth-provider/`,
        {},
        {
          // Allow for 403s
          allowError: error => error.status === 403,
        },
      ],
    ];
  }

  getTitle() {
    const orgId = this.props.organization.slug;
    return routeTitleGen(t('Members'), orgId, false);
  }

  removeMember = async (id: string) => {
    const {orgId} = this.props.params;

    await this.api.requestPromise(`/organizations/${orgId}/members/${id}/`, {
      method: 'DELETE',
      data: {},
    });

    this.setState(state => ({
      members: state.members.filter(({id: existingId}) => existingId !== id),
    }));
  };

  handleRemove = async ({id, name}: Member) => {
    const {organization} = this.props;
    const {slug: orgName} = organization;

    try {
      await this.removeMember(id);
    } catch {
      addErrorMessage(tct('Error removing [name] from [orgName]', {name, orgName}));
      return;
    }

    addSuccessMessage(tct('Removed [name] from [orgName]', {name, orgName}));
  };

  handleLeave = async ({id}: Member) => {
    const {organization} = this.props;
    const {slug: orgName} = organization;

    try {
      await this.removeMember(id);
    } catch {
      addErrorMessage(tct('Error leaving [orgName]', {orgName}));
      return;
    }

    redirectToRemainingOrganization({orgId: orgName, removeOrg: true});
    addSuccessMessage(tct('You left [orgName]', {orgName}));
  };

  handleSendInvite = async ({id}: Member) => {
    this.setState(state => ({
      invited: {...state.invited, [id]: 'loading'},
    }));

    try {
      await this.api.requestPromise(
        `/organizations/${this.props.params.orgId}/members/${id}/`,
        {method: 'PUT', data: {reinvite: 1}}
      );
    } catch {
      this.setState(state => ({invited: {...state.invited, [id]: null}}));
      addErrorMessage(t('Error sending invite'));
      return;
    }

    this.setState(state => ({invited: {...state.invited, [id]: 'success'}}));
  };

  renderBody() {
    const {params, router, organization} = this.props;
    const {membersPageLinks, members} = this.state;
    const {name: orgName, access} = organization;

    const canAddMembers = access.includes('member:write');
    const canRemove = access.includes('member:admin');
    const currentUser = ConfigStore.get('user');

    // Find out if current user is the only owner
    const isOnlyOwner = !members.find(
      ({role, email}) => role === 'owner' && email !== currentUser.email
    );

    // Only admins/owners can remove members
    const requireLink = !!this.state.authProvider && this.state.authProvider.require_link;

    return (
      <React.Fragment>
        <Panel data-test-id="org-member-list">
          <PanelHeader hasButtons>
            {t('Members')}

            {this.renderSearchInput({
              updateRoute: true,
              placeholder: t('Search Members'),
              className: 'search',
            })}
          </PanelHeader>

          <PanelBody>
            {members.map(member => {
              return (
                <OrganizationMemberRow
                  routes={router.routes}
                  params={params}
                  key={member.id}
                  member={member}
                  status={this.state.invited[member.id]}
                  orgId={params.orgId}
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
            {members.length === 0 && (
              <EmptyMessage>{t('No members found.')}</EmptyMessage>
            )}
          </PanelBody>
        </Panel>

        <Pagination pageLinks={membersPageLinks} />
      </React.Fragment>
    );
  }
}

export default withOrganization(OrganizationMembersList);
