import PropTypes from 'prop-types';
import React from 'react';

import {AccessRequest, Member, Organization} from 'app/types';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t, tct} from 'app/locale';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import InviteRequestRow from './inviteRequestRow';
import OrganizationAccessRequests from './organizationAccessRequests';

type Props = {
  api: any;
  params: any;
  organization: Organization;
  requestList: AccessRequest[];
  inviteRequests: Member[];
  onUpdateInviteRequests: (id: string) => void;
  onUpdateRequestList: (id: string) => void;
  showInviteRequests: boolean;
};

type State = {
  inviteRequestBusy: Map<string, boolean>;
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
    inviteRequestBusy: new Map(),
  };

  handleApprove = async (id: string, email: string) => {
    const {
      api,
      params: {orgId},
      onUpdateInviteRequests,
    } = this.props;

    this.setState(state => ({
      inviteRequestBusy: state.inviteRequestBusy.set(id, true),
    }));

    try {
      await api.requestPromise(`/organizations/${orgId}/invite-requests/${id}/`, {
        method: 'PUT',
        data: {approve: 1},
      });
      onUpdateInviteRequests(id);
      addSuccessMessage(tct('[email] has been invited', {email}));
    } catch (err) {
      addErrorMessage(tct('Error inviting [email]', {email}));
      throw err;
    }

    this.setState(state => ({
      inviteRequestBusy: state.inviteRequestBusy.set(id, false),
    }));
  };

  handleDeny = async (id: string, email: string) => {
    const {
      api,
      params: {orgId},
      onUpdateInviteRequests,
    } = this.props;

    this.setState(state => ({
      inviteRequestBusy: state.inviteRequestBusy.set(id, true),
    }));

    try {
      await api.requestPromise(`/organizations/${orgId}/invite-requests/${id}/`, {
        method: 'DELETE',
      });
      onUpdateInviteRequests(id);
      addSuccessMessage(tct('Invite request for [email] denied', {email}));
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
          orgId={orgId}
          requestList={requestList}
          onUpdateRequestList={onUpdateRequestList}
        />
      </React.Fragment>
    );
  }
}

export default withApi(withOrganization(OrganizationRequestsView));
