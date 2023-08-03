import {updateUser} from 'sentry/actionCreators/account';
import {APIRequestMethod} from 'sentry/api';
import AvatarChooser from 'sentry/components/avatarChooser';
import Form, {FormProps} from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import {JsonFormObject} from 'sentry/components/forms/types';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import accountDetailsFields from 'sentry/data/forms/accountDetails';
import accountPreferencesFields from 'sentry/data/forms/accountPreferences';
import {t} from 'sentry/locale';
import {Organization, User} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import DeprecatedAsyncView, {AsyncViewProps} from 'sentry/views/deprecatedAsyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

const ENDPOINT = '/users/me/';

interface Props extends AsyncViewProps {
  organization: Organization;
}

class AccountDetails extends DeprecatedAsyncView<Props> {
  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    // local state is NOT updated when the form saves
    return [['user', ENDPOINT]];
  }

  handleSubmitSuccess = (user: User) => {
    // the updateUser method updates our Config Store
    // No components listen to the ConfigStore, they just access it directly
    updateUser(user);
    // We need to update the state, because AvatarChooser is using it,
    // otherwise it will flick
    this.setState({
      user,
    });
  };

  getAccountPreferencesFields(): JsonFormObject[] {
    const formGroupsEventIssue = [...accountPreferencesFields];
    const transformOptions = (data: object) => ({options: data});

    if (
      this.props.organization.features.includes('issue-details-most-helpful-event-ui')
    ) {
      formGroupsEventIssue[0].fields.push({
        name: 'defaultIssueEvent',
        type: 'select',
        required: false,
        options: [
          {value: 'recommended', label: t('Recommended')},
          {value: 'latest', label: t('Latest')},
          {value: 'oldest', label: t('Oldest')},
        ],
        label: t('Default Issue Event'),
        help: t('Choose what event gets displayed by default'),
        getData: transformOptions,
      });
    }
    return formGroupsEventIssue;
  }

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
            forms={this.getAccountPreferencesFields()}
            additionalFieldProps={{user}}
          />
        </Form>
        <AvatarChooser
          endpoint="/users/me/avatar/"
          model={user}
          onSave={resp => {
            this.handleSubmitSuccess(resp as User);
          }}
          isUser
        />
      </div>
    );
  }
}

export default withOrganization(AccountDetails);
