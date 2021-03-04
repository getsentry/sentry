import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {openInviteMembersModal} from 'app/actionCreators/modal';
import AlertLink from 'app/components/alertLink';
import Badge from 'app/components/badge';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import {IconMail} from 'app/icons';
import {t} from 'app/locale';
import {Member, Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import routeTitleGen from 'app/utils/routeTitle';
import withOrganization from 'app/utils/withOrganization';
import AsyncView from 'app/views/asyncView';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

type Props = {
  children?: any;
  organization: Organization;
} & RouteComponentProps<{orgId: string}, {}>;

type State = AsyncView['state'] & {
  inviteRequests: Member[];
};

class OrganizationMembersWrapper extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {orgId} = this.props.params;

    return [
      ['inviteRequests', `/organizations/${orgId}/invite-requests/`],
      ['requestList', `/organizations/${orgId}/access-requests/`],
    ];
  }

  getTitle() {
    const {orgId} = this.props.params;
    return routeTitleGen(t('Members'), orgId, false);
  }

  get onRequestsTab() {
    return location.pathname.includes('/requests/');
  }

  get hasWriteAccess() {
    const {organization} = this.props;
    if (!organization || !organization.access) {
      return false;
    }
    return organization.access.includes('member:write');
  }

  get showInviteRequests() {
    return this.hasWriteAccess;
  }

  get showNavTabs() {
    const {requestList} = this.state;

    // show the requests tab if there are pending team requests,
    // or if the user has access to approve or deny invite requests
    return (requestList && requestList.length > 0) || this.showInviteRequests;
  }

  get requestCount() {
    const {requestList, inviteRequests} = this.state;
    let count = requestList.length;

    // if the user can't see the invite requests panel,
    // exclude those requests from the total count
    if (this.showInviteRequests) {
      count += inviteRequests.length;
    }
    return count ? count.toString() : null;
  }

  removeAccessRequest = (id: string) =>
    this.setState(state => ({
      requestList: state.requestList.filter(request => request.id !== id),
    }));

  removeInviteRequest = (id: string) =>
    this.setState(state => ({
      inviteRequests: state.inviteRequests.filter(request => request.id !== id),
    }));

  updateInviteRequest = (id: string, data: Partial<Member>) =>
    this.setState(state => {
      const inviteRequests = [...state.inviteRequests];
      const inviteIndex = inviteRequests.findIndex(request => request.id === id);

      inviteRequests[inviteIndex] = {...inviteRequests[inviteIndex], ...data};

      return {inviteRequests};
    });

  renderBody() {
    const {
      children,
      organization,
      params: {orgId},
    } = this.props;
    const {requestList, inviteRequests} = this.state;

    return (
      <React.Fragment>
        <SettingsPageHeader title="Members" />

        <AlertLink
          data-test-id="email-invite"
          icon={<IconMail />}
          priority="info"
          onClick={() => openInviteMembersModal({source: 'members_settings'})}
        >
          {t('Invite new members by email to join your organization')}
        </AlertLink>

        {this.showNavTabs && (
          <NavTabs underlined>
            <ListLink
              to={`/settings/${orgId}/members/`}
              isActive={() => !this.onRequestsTab}
              data-test-id="members-tab"
            >
              {t('Members')}
            </ListLink>
            <ListLink
              to={`/settings/${orgId}/members/requests/`}
              isActive={() => this.onRequestsTab}
              data-test-id="requests-tab"
              onClick={() => {
                this.showInviteRequests &&
                  trackAnalyticsEvent({
                    eventKey: 'invite_request.tab_clicked',
                    eventName: 'Invite Request Tab Clicked',
                    organization_id: organization.id,
                  });
              }}
            >
              {t('Requests')}
            </ListLink>
            {this.requestCount && <StyledBadge text={this.requestCount} />}
          </NavTabs>
        )}

        {children &&
          React.cloneElement(children, {
            requestList,
            inviteRequests,
            onRemoveInviteRequest: this.removeInviteRequest,
            onUpdateInviteRequest: this.updateInviteRequest,
            onRemoveAccessRequest: this.removeAccessRequest,
            showInviteRequests: this.showInviteRequests,
          })}
      </React.Fragment>
    );
  }
}

const StyledBadge = styled(Badge)`
  margin-left: -12px;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    margin-left: -6px;
  }
`;

export default withOrganization(OrganizationMembersWrapper);
