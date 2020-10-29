import {ClassNames} from '@emotion/core';
import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {Organization, Member, MemberRole} from 'app/types';
import {IconSliders} from 'app/icons';
import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ConfigStore from 'app/stores/configStore';
import Pagination from 'app/components/pagination';
import routeTitleGen from 'app/utils/routeTitle';
import SentryTypes from 'app/sentryTypes';
import {redirectToRemainingOrganization} from 'app/actionCreators/organizations';
import {resendMemberInvite} from 'app/actionCreators/members';
import withOrganization from 'app/utils/withOrganization';
import Button from 'app/components/button';
import DropdownMenu from 'app/components/dropdownMenu';
import space from 'app/styles/space';
import {MEMBER_ROLES} from 'app/constants';
import theme from 'app/utils/theme';

import OrganizationMemberRow from './organizationMemberRow';
import MembersFilter from './components/membersFilter';

type Props = {
  organization: Organization;
} & RouteComponentProps<{orgId: string}, {}>;

type State = AsyncView['state'] & {
  member: (Member & {roles: MemberRole[]}) | null;
  members: Member[];
  invited: {[key: string]: 'loading' | 'success' | null};
};

class OrganizationMembersList extends AsyncView<Props, State> {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      members: [],
      invited: {},
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
      ['members', `/organizations/${orgId}/members/`, {}, {paginate: true}],
      [
        'member',
        `/organizations/${orgId}/members/me/`,
        {},
        {allowError: error => error.status === 404},
      ],
      [
        'authProvider',
        `/organizations/${orgId}/auth-provider/`,
        {},
        {allowError: error => error.status === 403},
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

  handleSendInvite = async ({id, expired}) => {
    this.setState(state => ({
      invited: {...state.invited, [id]: 'loading'},
    }));

    try {
      await resendMemberInvite(this.api, {
        orgId: this.props.params.orgId,
        memberId: id,
        regenerate: expired,
      });
    } catch {
      this.setState(state => ({invited: {...state.invited, [id]: null}}));
      addErrorMessage(t('Error sending invite'));
      return;
    }

    this.setState(state => ({invited: {...state.invited, [id]: 'success'}}));
  };

  renderBody() {
    const {params, organization, routes} = this.props;
    const {membersPageLinks, members, member: currentMember} = this.state;
    const {name: orgName, access} = organization;

    const canAddMembers = access.includes('member:write');
    const canRemove = access.includes('member:admin');
    const currentUser = ConfigStore.get('user');

    // Find out if current user is the only owner
    const isOnlyOwner = !members.find(
      ({role, email, pending}) =>
        role === 'owner' && email !== currentUser.email && !pending
    );

    // Only admins/owners can remove members
    const requireLink = !!this.state.authProvider && this.state.authProvider.require_link;

    type RenderSearch = React.ComponentProps<
      typeof AsyncView.prototype.renderSearchInput
    >['children'];

    // eslint-disable-next-line react/prop-types
    const renderSearch: RenderSearch = ({defaultSearchBar, value, handleChange}) => (
      <SearchWrapper>
        {defaultSearchBar}
        <DropdownMenu closeOnEscape>
          {({getActorProps, isOpen}) => (
            <FilterWrapper>
              <Button
                size="small"
                icon={<IconSliders size="xs" />}
                {...getActorProps({})}
              >
                {t('Search Filters')}
              </Button>
              {isOpen && (
                <StyledMembersFilter
                  roles={currentMember?.roles ?? MEMBER_ROLES}
                  query={value}
                  onChange={(query: string) => handleChange(query)}
                />
              )}
            </FilterWrapper>
          )}
        </DropdownMenu>
      </SearchWrapper>
    );

    return (
      <React.Fragment>
        <ClassNames>
          {({css}) =>
            this.renderSearchInput({
              updateRoute: true,
              placeholder: t('Search Members'),
              children: renderSearch,
              className: css`
                font-size: ${theme.fontSizeMedium};
                padding: ${space(0.75)};
              `,
            })
          }
        </ClassNames>
        <Panel data-test-id="org-member-list">
          <PanelHeader>{t('Members')}</PanelHeader>

          <PanelBody>
            {members.map(member => (
              <OrganizationMemberRow
                routes={routes}
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
            ))}
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

const SearchWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  grid-gap: ${space(1.5)};
  margin-bottom: ${space(3)};
  position: relative;
`;

const FilterWrapper = styled('div')`
  position: relative;
`;

const StyledMembersFilter = styled(MembersFilter)`
  position: absolute;
  right: 0;
  top: 42px;
  z-index: ${p => p.theme.zIndex.dropdown};

  &:before,
  &:after {
    position: absolute;
    top: -16px;
    right: 32px;
    content: '';
    height: 16px;
    width: 16px;
    border: 8px solid transparent;
    border-bottom-color: ${p => p.theme.gray100};
  }

  &:before {
    margin-top: -1px;
    border-bottom-color: ${p => p.theme.borderLight};
  }
`;
export default withOrganization(OrganizationMembersList);
