import PropTypes from 'prop-types';
import React from 'react';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import routeTitleGen from 'app/utils/routeTitle';
import SentryTypes from 'app/sentryTypes';

import InviteRequestRow from './inviteRequestRow';
import OrganizationAccessRequests from './organizationAccessRequests';

class OrganizationRequestsView extends AsyncView {
  static propTypes = {
    params: PropTypes.object,
    inviteRequests: PropTypes.array,
    requestList: PropTypes.array,
    updateInviteRequests: PropTypes.func,
    updateRequestList: PropTypes.func,
  };

  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  static defaultProps = {
    inviteRequests: [],
  };

  state = {
    inviteRequestBusy: new Map(),
  };

  getEndpoints() {
    return [];
  }

  getTitle() {
    const {orgId} = this.props.params;
    return routeTitleGen(t('Requests'), orgId, false);
  }

  get showInviteRequests() {
    const {organization} = this.context;

    return (
      organization.experiments &&
      (organization.experiments.InviteRequestExperiment === 1 ||
        organization.experiments.JoinRequestExperiment === 1)
    );
  }

  handleApprove = async (id, email) => {
    const {
      params: {orgId},
      updateInviteRequests,
    } = this.props;

    this.setState(state => ({
      inviteRequestBusy: state.inviteRequestBusy.set(id, true),
    }));

    try {
      await this.api.requestPromise(`/organizations/${orgId}/invite-requests/${id}/`, {
        method: 'PUT',
        data: {approve: 1},
      });
      updateInviteRequests(id);
      addSuccessMessage(tct('[email] has been invited', {email}));
    } catch (err) {
      addErrorMessage(tct('Error inviting [email]', {email}));
      throw err;
    }

    this.setState(state => ({
      inviteRequestBusy: state.inviteRequestBusy.set(id, false),
    }));
  };

  handleDeny = async (id, email) => {
    const {
      params: {orgId},
      updateInviteRequests,
    } = this.props;

    this.setState(state => ({
      inviteRequestBusy: state.inviteRequestBusy.set(id, true),
    }));

    try {
      await this.api.requestPromise(`/organizations/${orgId}/invite-requests/${id}/`, {
        method: 'DELETE',
      });
      updateInviteRequests(id);
      addSuccessMessage(tct('Denied invite request for [email]', {email}));
    } catch (err) {
      addErrorMessage(tct('Error denying invite request for [email]', {email}));
      throw err;
    }

    this.setState(state => ({
      inviteRequestBusy: state.inviteRequestBusy.set(id, false),
    }));
  };

  render() {
    const {
      params: {orgId},
      requestList,
      inviteRequests,
      updateRequestList,
    } = this.props;
    const {inviteRequestBusy} = this.state;

    return (
      <React.Fragment>
        {this.showInviteRequests && (
          <Panel>
            <PanelHeader>{t('Pending Invite Requests')}</PanelHeader>
            <PanelBody>
              {inviteRequests.map(inviteRequest => (
                <InviteRequestRow
                  key={inviteRequest.id}
                  orgId={orgId}
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
          orgId={orgId}
          requestList={requestList}
          updateRequestList={updateRequestList}
        />
      </React.Fragment>
    );
  }
}

export default OrganizationRequestsView;
