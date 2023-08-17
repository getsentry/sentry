import {updateUser} from 'sentry/actionCreators/account';
import {APIRequestMethod} from 'sentry/api';
import AvatarChooser from 'sentry/components/avatarChooser';
import Form, {FormProps} from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import accountDetailsFields from 'sentry/data/forms/accountDetails';
import accountPreferencesFields from 'sentry/data/forms/accountPreferences';
import {t} from 'sentry/locale';
import {Avatar, Organization, User} from 'sentry/types';
import {UserExperiments} from 'sentry/types/experiments';
import withOrganization from 'sentry/utils/withOrganization';
import DeprecatedAsyncView, {AsyncViewProps} from 'sentry/views/deprecatedAsyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

export type ChangeAvatarUser = {
  avatar: Avatar;
  avatarUrl: string;
  dateJoined: string;
  email: string;
  emails: {
    email: string;
    id: string;
    is_verified: boolean;
  }[];
  experiments: Partial<UserExperiments>;
  has2fa: boolean;
  hasPasswordAuth: boolean;
  id: string;
  isActive: boolean;
  isManaged: boolean;
  isStaff: boolean;
  isSuperuser: boolean;
  lastActive: string;
  lastLogin: string;
  name: string;
  username: string;
  canReset2fa?: boolean;
  flags?: {newsletter_consent_prompt: boolean};
  identities?: any[];
  ip_address?: string;
  isAuthenticated?: boolean;
  options?: {
    avatarType: Avatar['avatarType'];
  };
  permissions?: Set<string>;
};

const ENDPOINT = '/users/me/';

interface Props extends AsyncViewProps {
  organization: Organization;
}

class AccountDetails extends DeprecatedAsyncView<Props> {
  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    // local state is NOT updated when the form saves
    return [['user', ENDPOINT]];
  }

  handleSubmitSuccess = (user: User | ChangeAvatarUser) => {
    // the updateUser method updates our Config Store
    // No components listen to the ConfigStore, they just access it directly
    updateUser(user as User);
    // We need to update the state, because AvatarChooser is using it,
    // otherwise it will flick
    this.setState({
      user,
    });
  };

  renderBody() {
    const user = this.state.user as User;

    const formCommonProps: Partial<FormProps> = {
      apiEndpoint: ENDPOINT,
      apiMethod: 'PUT' as APIRequestMethod,
      allowUndo: true,
      saveOnBlur: true,
      onSubmitSuccess: this.handleSubmitSuccess,
    };

    return (
      <div>
        <SentryDocumentTitle title={t('Account Details')} />
        <SettingsPageHeader title={t('Account Details')} />
        <Form initialData={user} {...formCommonProps}>
          <JsonForm forms={accountDetailsFields} additionalFieldProps={{user}} />
        </Form>
        <Form initialData={user.options} {...formCommonProps}>
          <JsonForm
            forms={accountPreferencesFields}
            additionalFieldProps={{
              user,
              organization: this.props.organization,
            }}
          />
        </Form>
        <AvatarChooser
          endpoint="/users/me/avatar/"
          model={user}
          onSave={resp => {
            this.handleSubmitSuccess(resp as ChangeAvatarUser);
          }}
          isUser
        />
      </div>
    );
  }
}

export default withOrganization(AccountDetails);
