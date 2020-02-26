import PropTypes from 'prop-types';
import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {MEMBER_ROLES} from 'app/constants';
import {AccessRequest, Member, Organization, Team} from 'app/types';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t, tct} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import withOrganization from 'app/utils/withOrganization';
import withTeams from 'app/utils/withTeams';
import AsyncView from 'app/views/asyncView';

import InviteRequestRow from './inviteRequestRow';
import OrganizationAccessRequests from './organizationAccessRequests';

type DefaultProps = {
  inviteRequests: Member[];
};

type Props = {
  organization: Organization;
  requestList: AccessRequest[];
  teams: Team[];
  onUpdateInviteRequest: (id: string, data: Partial<Member>) => void;
  onRemoveInviteRequest: (id: string) => void;
  onRemoveAccessRequest: (id: string) => void;
  showInviteRequests: boolean;
} & RouteComponentProps<{orgId: string}, {}> &
  DefaultProps;

type State = AsyncView['state'] & {
  inviteRequestBusy: {[key: string]: boolean};
};

class OrganizationRequestsView extends AsyncView<Props, State> {
  static propTypes = {
    requestList: PropTypes.array.isRequired,
    inviteRequests: PropTypes.array.isRequired,
    onRemoveInviteRequest: PropTypes.func.isRequired,
    onRemoveAccessRequest: PropTypes.func.isRequired,
    showInviteRequests: PropTypes.bool.isRequired,
  };

  static defaultProps: DefaultProps = {
    inviteRequests: [],
  };

  getDefaultState() {
    const state = super.getDefaultState();
    return {
      ...state,
      inviteRequestBusy: {},
    };
  }

  UNSAFE_componentWillMount() {
    super.UNSAFE_componentWillMount();
    this.handleRedirect();
  }

  componentDidUpdate() {
    this.handleRedirect();
  }

  getEndpoints(): [string, string][] {
    const orgId = this.props.organization.slug;

    return [['member', `/organizations/${orgId}/members/me/`]];
  }

  handleRedirect() {
    const {router, params, requestList, showInviteRequests} = this.props;

    // redirect to the members view if the user cannot see
    // the invite requests panel and all of the team requests
    // have been approved or denied
    if (showInviteRequests || requestList.length) {
      return null;
    }
    return router.push(`/settings/${params.orgId}/members/`);
  }

  handleAction = async ({
    inviteRequest,
    method,
    data,
    successMessage,
    errorMessage,
    eventKey,
    eventName,
  }) => {
    const {params, organization, onRemoveInviteRequest} = this.props;

    this.setState(state => ({
      inviteRequestBusy: {...state.inviteRequestBusy, [inviteRequest.id]: true},
    }));

    try {
      await this.api.requestPromise(
        `/organizations/${params.orgId}/invite-requests/${inviteRequest.id}/`,
        {
          method,
          data,
        }
      );

      onRemoveInviteRequest(inviteRequest.id);
      addSuccessMessage(successMessage);
      trackAnalyticsEvent({
        eventKey,
        eventName,
        organization_id: organization.id,
        member_id: parseInt(inviteRequest.id, 10),
        invite_status: inviteRequest.inviteStatus,
      });
    } catch {
      addErrorMessage(errorMessage);
    }

    this.setState(state => ({
      inviteRequestBusy: {...state.inviteRequestBusy, [inviteRequest.id]: false},
    }));
  };

  handleApprove = (inviteRequest: Member) => {
    this.handleAction({
      inviteRequest,
      method: 'PUT',
      data: {
        role: inviteRequest.role,
        teams: inviteRequest.teams,
        approve: 1,
      },
      successMessage: tct('[email] has been invited', {email: inviteRequest.email}),
      errorMessage: tct('Error inviting [email]', {email: inviteRequest.email}),
      eventKey: 'invite_request.approved',
      eventName: 'Invite Request Approved',
    });
  };

  handleDeny = (inviteRequest: Member) => {
    this.handleAction({
      inviteRequest,
      method: 'DELETE',
      data: {},
      successMessage: tct('Invite request for [email] denied', {
        email: inviteRequest.email,
      }),
      errorMessage: tct('Error denying invite request for [email]', {
        email: inviteRequest.email,
      }),
      eventKey: 'invite_request.denied',
      eventName: 'Invite Request Denied',
    });
  };

  render() {
    const {
      params,
      requestList,
      showInviteRequests,
      inviteRequests,
      onRemoveAccessRequest,
      onUpdateInviteRequest,
      organization,
      teams,
    } = this.props;
    const {inviteRequestBusy, member} = this.state;

    return (
      <React.Fragment>
        {showInviteRequests && (
          <Panel>
            <PanelHeader>{t('Pending Invite Requests')}</PanelHeader>
            <PanelBody>
              {inviteRequests.map(inviteRequest => (
                <InviteRequestRow
                  key={inviteRequest.id}
                  organization={organization}
                  inviteRequest={inviteRequest}
                  inviteRequestBusy={inviteRequestBusy}
                  allTeams={teams}
                  allRoles={member ? member.roles : MEMBER_ROLES}
                  onApprove={this.handleApprove}
                  onDeny={this.handleDeny}
                  onUpdate={data => onUpdateInviteRequest(inviteRequest.id, data)}
                />
              ))}
              {inviteRequests.length === 0 && (
                <EmptyMessage>{t('No requests found.')}</EmptyMessage>
              )}
            </PanelBody>
          </Panel>
        )}

        <OrganizationAccessRequests
          orgId={params.orgId}
          requestList={requestList}
          onRemoveAccessRequest={onRemoveAccessRequest}
        />
      </React.Fragment>
    );
  }
}

export default withTeams(withOrganization(OrganizationRequestsView));
