import {cloneElement, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {Button} from 'sentry/components/button';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {Hovercard} from 'sentry/components/hovercard';
import {IconMail} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Member, Organization} from 'sentry/types';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

type Props = {
  organization: Organization;
  children?: any;
} & RouteComponentProps<{}, {}>;

type State = DeprecatedAsyncView['state'] & {
  inviteRequests: Member[];
};

const InviteMembersButtonHook = HookOrDefault({
  hookName: 'member-invite-button:customization',
  defaultComponent: ({children, organization, onTriggerModal}) =>
    children({
      disabled: !organization.features.includes('invite-members'),
      onTriggerModal,
    }),
});

class OrganizationMembersWrapper extends DeprecatedAsyncView<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    const {organization} = this.props;

    return [
      ['inviteRequests', `/organizations/${organization.slug}/invite-requests/`],
      ['requestList', `/organizations/${organization.slug}/access-requests/`],
    ];
  }

  getTitle() {
    const {organization} = this.props;
    return routeTitleGen(t('Members'), organization.slug, false);
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
        {renderInviteMembersButton}
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

function renderInviteMembersButton({
  disabled,
  onTriggerModal,
}: {
  onTriggerModal: () => void;
  disabled?: boolean;
}) {
  const action = (
    <Button
      priority="primary"
      size="sm"
      onClick={onTriggerModal}
      data-test-id="email-invite"
      icon={<IconMail />}
      disabled={disabled}
    >
      {t('Invite Members')}
    </Button>
  );

  return disabled ? (
    <Hovercard
      body={
        <FeatureDisabled
          featureName={t('Invite Members')}
          features="organizations:invite-members"
          hideHelpToggle
        />
      }
    >
      {action}
    </Hovercard>
  ) : (
    action
  );
}

export default withOrganization(OrganizationMembersWrapper);
