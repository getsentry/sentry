import {cloneElement} from 'react';
import {RouteComponentProps} from 'react-router';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {fetchOrganizations} from 'sentry/actionCreators/organizations';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import {t} from 'sentry/locale';
import {Authenticator, OrganizationSummary, UserEmail} from 'sentry/types';
import {defined} from 'sentry/utils';

const ENDPOINT = '/users/me/authenticators/';

type Props = {
  children: React.ReactElement;
} & RouteComponentProps<{authId: string}, {}> &
  DeprecatedAsyncComponent['props'];

type State = {
  emails: UserEmail[];
  loadingOrganizations: boolean;
  authenticators?: Authenticator[] | null;
  organizations?: OrganizationSummary[];
} & DeprecatedAsyncComponent['state'];

class AccountSecurityWrapper extends DeprecatedAsyncComponent<Props, State> {
  async fetchOrganizations() {
    try {
      this.setState({loadingOrganizations: true});
      const organizations = await fetchOrganizations(this.api);
      this.setState({organizations, loadingOrganizations: false});
    } catch (e) {
      this.setState({error: true, loadingOrganizations: false});
    }
  }

  get shouldRenderLoading() {
    return super.shouldRenderLoading || this.state.loadingOrganizations === true;
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    return [
      ['authenticators', ENDPOINT],
      ['emails', '/users/me/emails/'],
    ];
  }

  componentDidMount() {
    super.componentDidMount();
    this.fetchOrganizations();
  }

  reloadData() {
    this.fetchOrganizations();
    super.reloadData();
  }

  handleDisable = async (auth: Authenticator) => {
    if (!auth || !auth.authId) {
      return;
    }

    this.setState({loading: true});

    try {
      await this.api.requestPromise(`${ENDPOINT}${auth.authId}/`, {method: 'DELETE'});
      this.reloadData();
    } catch (_err) {
      this.setState({loading: false});
      addErrorMessage(t('Error disabling %s', auth.name));
    }
  };

  handleRegenerateBackupCodes = async () => {
    this.setState({loading: true});

    try {
      await this.api.requestPromise(`${ENDPOINT}${this.props.params.authId}/`, {
        method: 'PUT',
      });
      this.reloadData();
    } catch (_err) {
      this.setState({loading: false});
      addErrorMessage(t('Error regenerating backup codes'));
    }
  };

  handleRefresh = () => {
    this.reloadData();
  };

  renderBody() {
    const {children} = this.props;
    const {authenticators, organizations, emails} = this.state;
    const enrolled =
      authenticators?.filter(auth => auth.isEnrolled && !auth.isBackupInterface) || [];
    const countEnrolled = enrolled.length;
    const orgsRequire2fa = organizations?.filter(org => org.require2FA) || [];
    const deleteDisabled = orgsRequire2fa.length > 0 && countEnrolled === 1;
    const hasVerifiedEmail = !!emails?.find(({isVerified}) => isVerified);

    // This happens when you switch between children views and the next child
    // view is lazy loaded, it can potentially be `null` while the code split
    // package is being fetched
    if (!defined(children)) {
      return null;
    }

    return cloneElement(this.props.children, {
      onDisable: this.handleDisable,
      onRegenerateBackupCodes: this.handleRegenerateBackupCodes,
      authenticators,
      deleteDisabled,
      orgsRequire2fa,
      countEnrolled,
      hasVerifiedEmail,
      handleRefresh: this.handleRefresh,
    });
  }
}

export default AccountSecurityWrapper;
