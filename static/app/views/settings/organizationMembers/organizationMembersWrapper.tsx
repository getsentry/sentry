import {cloneElement, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {t} from 'sentry/locale';
import {Member, Organization} from 'sentry/types';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import InviteMembersButton from './components/inviteMembersButton';

type Props = {
  organization: Organization;
  children?: any;
} & RouteComponentProps<{orgId: string}, {}>;

type State = AsyncView['state'] & {
  inviteRequests: Member[];
};

const InviteMembersButtonHook = HookOrDefault({
  hookName: 'member-invite-buttom:customization',
  defaultComponent: ({children, organization}) =>
    children({disabled: !organization.features.includes('invite-members')}),
});

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
    const {children, organization} = this.props;
    const {requestList, inviteRequests} = this.state;

    const action = (
      <InviteMembersButtonHook
        organization={organization}
        onTriggerModal={() =>
          openInviteMembersModal({
            onClose: () => {
              this.fetchData();
            },
            source: 'members_settings',
          })
        }
      >
        {({disabled, onTriggerModal}) => (
          <InviteMembersButton disabled={disabled} onClick={onTriggerModal} />
        )}
      </InviteMembersButtonHook>
    );

    return (
      <Fragment>
        <SettingsPageHeader title="Members" action={action} />
        {children &&
          cloneElement(children, {
            requestList,
            inviteRequests,
            onRemoveInviteRequest: this.removeInviteRequest,
            onUpdateInviteRequest: this.updateInviteRequest,
            onRemoveAccessRequest: this.removeAccessRequest,
            showInviteRequests: this.showInviteRequests,
          })}
      </Fragment>
    );
  }
}

export default withOrganization(OrganizationMembersWrapper);
