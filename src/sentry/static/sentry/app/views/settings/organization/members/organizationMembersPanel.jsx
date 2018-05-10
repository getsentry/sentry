import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import {debounce} from 'lodash';
import idx from 'idx';
import {AutoSizer, List} from 'react-virtualized';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ConfigStore from 'app/stores/configStore';
import Input from 'app/views/settings/components/forms/controls/input';
import Pagination from 'app/components/pagination';
import SentryTypes from 'app/proptypes';
import 'react-virtualized/styles.css';

import OrganizationMemberRow from './organizationMemberRow';

class OrganizationMembersPanel extends AsyncComponent {
  static propTypes = {
    routes: PropTypes.array,
    authProvider: PropTypes.object,
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
      ['requestList', `/organizations/${this.props.params.orgId}/access-requests/`],
    ];
  }

  handleSearch = e => {
    let {router, location} = this.props;
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

  handleRemove = ({id, name}, e) => {
    let {organization} = this.props;
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
    let {organization} = this.props;
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

  rowRenderer = ({index, isScrolling, isVisible, key, parent, style}) => {
    let {params, routes, organization, authProvider} = this.props;
    let {members} = this.state;
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
    let requireLink = authProvider && authProvider.require_link;
    const member = members[index];

    // If row content is complex, consider rendering a light-weight placeholder while scrolling.
    return (
      <OrganizationMemberRow
        style={style}
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
  };

  renderBody() {
    let {params, routes, organization, authProvider} = this.props;
    let {membersPageLinks, members} = this.state;
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
    let requireLink = authProvider && authProvider.require_link;

    return (
      <React.Fragment>
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
            <div style={{height: 77 * Math.min(members.length, 10)}}>
              <AutoSizer>
                {({width}) => (
                  <List
                    height={77 * Math.min(members.length, 10)}
                    rowCount={members.length}
                    rowHeight={77}
                    rowRenderer={this.rowRenderer}
                    width={width}
                  />
                )}
              </AutoSizer>
            </div>
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

export {OrganizationMembersPanel};
export default withRouter(OrganizationMembersPanel);
