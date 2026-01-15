import {Fragment} from 'react';

import {updateUser} from 'sentry/actionCreators/account';
import AvatarChooser from 'sentry/components/avatarChooser';
import type {FormProps} from 'sentry/components/forms/form';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {createAccountDetailsForm} from 'sentry/data/forms/accountDetails';
import accountPreferencesFields from 'sentry/data/forms/accountPreferences';
import {t} from 'sentry/locale';
import type {User} from 'sentry/types/user';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

// The avatar endpoint ("/users/me/avatar/") returns a User-like type without `options` and other properties that are present in User
export type ChangeAvatarUser = Omit<
  User,
  'canReset2fa' | 'flags' | 'identities' | 'isAuthenticated' | 'options' | 'permissions'
> &
  Partial<
    Pick<
      User,
      | 'canReset2fa'
      | 'flags'
      | 'identities'
      | 'isAuthenticated'
      | 'options'
      | 'permissions'
    >
  >;

const USER_ENDPOINT = '/users/me/';
const USER_ENDPOINT_QUERY_KEY: ApiQueryKey = [USER_ENDPOINT];

function AccountDetails() {
  const organization = useOrganization({allowNull: true});
  const queryClient = useQueryClient();
  const {
    data: user,
    isPending,
    isError,
    refetch,
  } = useApiQuery<User>(USER_ENDPOINT_QUERY_KEY, {staleTime: 0});

  if (isPending) {
    return (
      <Fragment>
        <SettingsPageHeader title={t('Account Details')} />
        <LoadingIndicator />
      </Fragment>
    );
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const handleSubmitSuccess = (userData: User | ChangeAvatarUser) => {
    // the updateUser method updates our Config Store
    // No components listen to the ConfigStore, they just access it directly
    updateUser(userData);
    // We need to update the state, because AvatarChooser is using it,
    // otherwise it will flick
    setApiQueryData(queryClient, USER_ENDPOINT_QUERY_KEY, userData);
  };

  const formCommonProps: Partial<FormProps> = {
    apiEndpoint: USER_ENDPOINT,
    apiMethod: 'PUT',
    allowUndo: true,
    saveOnBlur: true,
    onSubmitSuccess: handleSubmitSuccess,
  };

  const formConfig = createAccountDetailsForm({includeUserId: true, user});

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Account Details')} />
      <SettingsPageHeader title={t('Account Details')} />
      <Form initialData={user} {...formCommonProps}>
        <JsonForm forms={formConfig} additionalFieldProps={{user}} />
      </Form>
      <Form initialData={user.options} {...formCommonProps}>
        <JsonForm
          forms={accountPreferencesFields}
          additionalFieldProps={{
            user,
            organization,
          }}
        />
      </Form>
      <AvatarChooser
        endpoint="/users/me/avatar/"
        supportedTypes={['letter_avatar', 'gravatar', 'upload']}
        model={user}
        type="user"
        onSave={resp => handleSubmitSuccess(resp as ChangeAvatarUser)}
      />
    </Fragment>
  );
}

export default AccountDetails;
