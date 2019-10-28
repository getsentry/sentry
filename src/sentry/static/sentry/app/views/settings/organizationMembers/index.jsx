import PropTypes from 'prop-types';
import React from 'react';
import {debounce} from 'lodash';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
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
    const searchQuery = nextProps.location.query.query;
    if (searchQuery !== this.props.location.query.query) {
      this.setState({searchQuery});
    }
  }

  // XXX(billy): setState causes re-render of the entire view...
  // we should not do this
  getDefaultState() {
    const state = super.getDefaultState();
    return {
      ...state,
      members: [],
      invited: new Map(),
      searchQuery: this.props.location.query.query || '',
    };
  }

  getEndpoints() {
    return [
      [
        'members',
        `/organizations/${this.props.params.orgId}/members/`,
        {
          query: {
            query: this.props.location.query.query,
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
    ];
  }

  getTitle() {
    const orgId = this.props.organization.slug;
    return routeTitleGen(t('Members'), orgId, false);
  }

  removeMember = id => {
    const {params} = this.props;
    const {orgId} = params || {};

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

  handleRemove = ({id, name}) => {
    const {organization} = this.props;
    const {slug: orgName} = organization;

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

  handleLeave = ({id}) => {
    const {organization} = this.props;
    const {slug: orgName} = organization;

    this.removeMember(id).then(
      () => {
        redirectToRemainingOrganization({orgId: orgName, removeOrg: true});

        addSuccessMessage(
          tct('You left [orgName]', {
            orgName,
          })
        );
      },
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
      success: () =>
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
    const searchQuery = evt.target.value;
    this.getMembers(searchQuery);
    this.setState({searchQuery});
  };

  getMembers = debounce(searchQuery => {
    const {params} = this.props;
    const {orgId} = params || {};

    this.api.request(`/organizations/${orgId}/members/?query=${searchQuery}`, {
      method: 'GET',
      success: (data, _, jqXHR) => {
        this.handleRequestSuccess({stateKey: 'members', data, jqXHR});
      },
    });
  }, 200);

  renderBody() {
    const {params, routes, organization} = this.props;
    const {membersPageLinks, members} = this.state;
    const {orgId} = params || {};
    const {name: orgName, access} = organization;
    const canAddMembers = access.indexOf('member:write') > -1;
    const canRemove = access.indexOf('member:admin') > -1;
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

export default withOrganization(OrganizationMembersView);
