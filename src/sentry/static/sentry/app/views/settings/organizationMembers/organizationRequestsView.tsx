import PropTypes from 'prop-types';
import React from 'react';
import * as ReactRouter from 'react-router';

import {AccessRequest, Member, Organization} from 'app/types';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t, tct} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import InviteRequestRow from './inviteRequestRow';
import OrganizationAccessRequests from './organizationAccessRequests';

type Props = {
  api: any;
  params: any;
  router: ReactRouter.InjectedRouter;
  organization: Organization;
  requestList: AccessRequest[];
  inviteRequests: Member[];
  onUpdateInviteRequests: (id: string) => void;
  onUpdateRequestList: (id: string) => void;
  showInviteRequests: boolean;
};

type State = {
  inviteRequestBusy: {[key: string]: boolean};
};

class OrganizationRequestsView extends React.Component<Props, State> {
  static propTypes = {
    api: PropTypes.object.isRequired,
    requestList: PropTypes.array.isRequired,
    inviteRequests: PropTypes.array.isRequired,
    onUpdateInviteRequests: PropTypes.func.isRequired,
    onUpdateRequestList: PropTypes.func.isRequired,
    showInviteRequests: PropTypes.bool.isRequired,
  };

  static defaultProps = {
    inviteRequests: [],
  };

  state: State = {
    inviteRequestBusy: {},
  };

  componentWillMount() {
    this.handleRedirect();
  }

  componentDidMount() {
    const {organization, showInviteRequests} = this.props;
    showInviteRequests &&
      trackAnalyticsEvent({
        eventKey: 'invite_request.page_viewed',
        eventName: 'Invite Request Page Viewed',
        organization_id: organization.id,
      });
  }

  componentDidUpdate() {
    this.handleRedirect();
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
    const {api, params, organization, onUpdateInviteRequests} = this.props;

    this.setState(state => ({
      inviteRequestBusy: {...state.inviteRequestBusy, [inviteRequest.id]: true},
    }));

    try {
      await api.requestPromise(
        `/organizations/${params.orgId}/invite-requests/${inviteRequest.id}/`,
        {
          method,
          data,
        }
      );

      onUpdateInviteRequests(inviteRequest.id);
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
      data: {approve: 1},
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
      onUpdateRequestList,
      organization,
    } = this.props;
    const {inviteRequestBusy} = this.state;

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
                  onApprove={this.handleApprove}
                  onDeny={this.handleDeny}
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
          onUpdateRequestList={onUpdateRequestList}
        />
      </React.Fragment>
    );
  }
}

export default withApi(withOrganization(OrganizationRequestsView));
