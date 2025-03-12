import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {openConfirmModal} from 'sentry/components/confirm';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import ConfigStore from 'sentry/stores/configStore';
import type {UserIdentityConfig} from 'sentry/types/auth';
import {UserIdentityCategory, UserIdentityStatus} from 'sentry/types/auth';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {InternalAppApiToken, User} from 'sentry/types/user';

import DetailsPage from 'admin/components/detailsPage';
import MergeAccountsModal from 'admin/components/mergeAccounts';
import SelectableContainer from 'admin/components/selectableContainer';
import UserCustomers from 'admin/components/users/userCustomers';
import UserEmailLog from 'admin/components/users/userEmailLog';
import UserEmails from 'admin/components/users/userEmails';
import UserOverview from 'admin/components/users/userOverview';
import UserPermissionsModal from 'admin/components/users/userPermissionsModal';

type Props = DeprecatedAsyncComponent['props'] &
  RouteComponentProps<{userId: string}, unknown>;

type State = DeprecatedAsyncComponent['state'] & {
  identities: UserIdentityConfig[] | null;
  user: User | null;
};

class UserDetails extends DeprecatedAsyncComponent<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {userId} = this.props.params;
    return [
      ['user', `/users/${userId}/`],
      ['identities', `/users/${userId}/user-identities/`],
      ['tokens', '/api-tokens/', {query: {userId}}],
    ];
  }

  onMergeAccounts = ({error = null}) =>
    error
      ? addErrorMessage('An error occurred while merging users')
      : addSuccessMessage('Usernames have been merged');

  onUpdate = (params: Record<string, any>) => {
    addLoadingMessage('Saving changes...');
    this.api.request(`/users/${this.props.params.userId}/`, {
      method: 'PUT',
      data: params,
      success: data => {
        clearIndicators();
        addSuccessMessage(
          `User account has been updated with ${JSON.stringify(params)}.`
        );
        this.setState({user: data, identities: this.state.identities});
      },
      error: () => {
        addErrorMessage('There was an internal error with updating the user account.');
        clearIndicators();
      },
    });
  };

  onAuthenticatorRemove = (auth: NonNullable<User['authenticators']>[number]) => {
    const endpoint = `/users/${this.props.params.userId}/authenticators/${auth.id}/`;

    openConfirmModal({
      message: 'Are you sure you want to remove this authenticator?',
      onConfirm: () =>
        this.api.request(endpoint, {
          method: 'DELETE',
          success: () => {
            addSuccessMessage('Authenticator has been removed.');
            const authenticators =
              this.state.user?.authenticators?.filter(a => a.id !== auth.id) ?? [];
            this.setState({data: {...this.state.user!, authenticators}});
          },
          error: () => {
            addErrorMessage('Unable to remove authenticator from account.');
          },
        }),
    });
  };

  onIdentityDisconnect = (identity: UserIdentityConfig) => {
    const usesConfigEndpoint = identity.status === UserIdentityStatus.CAN_DISCONNECT;
    if (!usesConfigEndpoint && identity.category !== UserIdentityCategory.ORG_IDENTITY) {
      throw new Error('Identity is not eligible for deletion.'); // button should not be rendered
    }

    const endpoint = usesConfigEndpoint
      ? `/users/${this.props.params.userId}/user-identities/${identity.category}/${identity.id}/`
      : `/users/${this.props.params.userId}/identities/${identity.id}/`;

    openConfirmModal({
      message:
        'Are you sure you want to disconnect this identity?' +
        (identity.status === UserIdentityStatus.NEEDED_FOR_GLOBAL_AUTH
          ? ' (Caution: User may be locked out of platform login.)'
          : '') +
        (identity.status === UserIdentityStatus.NEEDED_FOR_ORG_AUTH
          ? ' (Caution: User may be locked out of org access.)'
          : ''),
      onConfirm: () =>
        this.api.request(endpoint, {
          method: 'DELETE',
          success: () => {
            addSuccessMessage('Identity has been disconnected.');
            const identities =
              this.state.identities?.filter(
                i => i.id !== identity.id || i.category !== identity.category
              ) ?? [];
            this.setState({user: this.state.user!, identities});
          },
          error: () => {
            addErrorMessage('Unable to remove identity from account.');
          },
        }),
    });
  };

  revokeToken = (token: InternalAppApiToken) => {
    const {userId} = this.props.params;
    this.api.request('/api-tokens/', {
      method: 'DELETE',
      data: {userId, tokenId: token.id},
      success: () => {
        addSuccessMessage('Token has been revoked.');
        const tokens = this.state.tokens?.filter((tkn: any) => tkn.id !== token.id) ?? [];
        this.setState({user: this.state.user!, tokens});
      },
      error: () => {
        addErrorMessage('Unable to revoke token.');
      },
    });
  };

  renderBody() {
    const {user, identities, tokens = []} = this.state;

    if (user === null) {
      return null;
    }

    const emailSections: React.ComponentProps<typeof SelectableContainer>['sections'] = [
      {
        key: 'emails',
        name: 'Addresses',
        content: ({Panel}) => <UserEmails Panel={Panel} user={user} />,
      },
      {
        key: 'log',
        name: 'Log',
        content: ({Panel}) => <UserEmailLog Panel={Panel} user={user} />,
      },
    ];

    const userEmails = (
      <SelectableContainer
        dropdownPrefix="Emails"
        panelTitle="User Emails"
        sections={emailSections}
      />
    );

    return (
      <DetailsPage
        rootName="Users"
        name={user.name === user.email ? user.email : `${user.name} (${user.email})`}
        badges={[{name: 'Inactive', level: 'warning', visible: !user.isActive}]}
        actions={[
          {
            key: 'edit-permissions',
            name: 'Edit Permissions',
            help: 'Configure _admin permissions.',
            skipConfirmModal: true,
            disabled: !ConfigStore.get('user').permissions.has('users.admin'),
            onAction: () => {
              openModal(deps => (
                <UserPermissionsModal
                  {...deps}
                  user={user}
                  onSubmit={(newUser: User) => {
                    this.setState({user: newUser});
                  }}
                />
              ));
            },
          },
          {
            key: 'mergeAccounts',
            name: 'Merge Accounts',
            help: 'Merge two or more user accounts',
            visible: user.isActive,
            skipConfirmModal: true,
            onAction: () =>
              openModal(deps => (
                <MergeAccountsModal
                  {...deps}
                  userId={user.id}
                  onAction={this.onMergeAccounts}
                />
              )),
          },
          {
            key: 'reactivate',
            name: 'Reactivate Account',
            help: 'Restores this account allowing the user to login.',
            visible: !user.isActive,
            onAction: this.onUpdate.bind(this, {isActive: 1}),
          },
        ]}
        sections={[
          {
            content: (
              <UserOverview
                user={user}
                tokens={tokens}
                identities={identities || []}
                onAuthenticatorRemove={this.onAuthenticatorRemove}
                onIdentityDisconnect={this.onIdentityDisconnect}
                revokeToken={this.revokeToken}
              />
            ),
          },
          {
            noPanel: true,
            content: <UserCustomers userId={user.id} />,
          },
          {
            noPanel: true,
            content: userEmails,
          },
        ]}
      />
    );
  }
}

export default UserDetails;
