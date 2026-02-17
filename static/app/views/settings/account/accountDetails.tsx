import {Fragment} from 'react';
import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveField, FieldGroup} from '@sentry/scraps/form';

import {updateUser} from 'sentry/actionCreators/account';
import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import AvatarChooser from 'sentry/components/avatarChooser';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import languages from 'sentry/data/languages';
import {timezoneOptions} from 'sentry/data/timezones';
import {t} from 'sentry/locale';
import {StacktraceOrder, type User} from 'sentry/types/user';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  fetchMutation,
  setApiQueryData,
  useApiQuery,
  useQueryClient,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';
import {removeBodyTheme} from 'sentry/utils/removeBodyTheme';
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

const USER_ENDPOINT = getApiUrl('/users/$userId/', {path: {userId: 'me'}});
const USER_ENDPOINT_QUERY_KEY: ApiQueryKey = [USER_ENDPOINT];

const accountDetailsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  username: z.string().min(1, 'Username is required'),
  id: z.string(),
});

const preferencesSchema = z.object({
  theme: z.string(),
  language: z.string(),
  timezone: z.string(),
  stacktraceOrder: z.string(),
  defaultIssueEvent: z.string(),
  clock24Hours: z.boolean(),
});

type Preferences = z.infer<typeof preferencesSchema>;

const THEME_OPTIONS = [
  {value: 'light', label: t('Light')},
  {value: 'dark', label: t('Dark')},
  {value: 'system', label: t('Default to system')},
];

const LANGUAGE_OPTIONS = languages.map(([value, label]) => ({value, label}));

const STACKTRACE_ORDER_OPTIONS = [
  {value: String(StacktraceOrder.DEFAULT), label: t('Default')},
  {value: String(StacktraceOrder.MOST_RECENT_LAST), label: t('Oldest first')},
  {value: String(StacktraceOrder.MOST_RECENT_FIRST), label: t('Newest first')},
];

const DEFAULT_ISSUE_EVENT_OPTIONS = [
  {value: 'recommended', label: t('Recommended')},
  {value: 'latest', label: t('Latest')},
  {value: 'oldest', label: t('Oldest')},
];

function AccountDetails() {
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
    // otherwise it will flick.
    // Use an updater function to merge with existing data because the avatar
    // endpoint returns a partial `User` without `options` and other fields.
    setApiQueryData<User>(queryClient, USER_ENDPOINT_QUERY_KEY, previousData => {
      if (!previousData) {
        return userData as User;
      }
      return {
        ...previousData,
        ...userData,
        options: {...previousData.options, ...userData.options},
      };
    });
  };

  const userMutationOptions = mutationOptions({
    mutationFn: (data: Partial<User>) => {
      return fetchMutation<User>({
        method: 'PUT',
        url: USER_ENDPOINT,
        data,
      });
    },
    onSuccess: data => {
      handleSubmitSuccess(data);
      addSuccessMessage(t('Account details updated'));
    },
  });

  const userOptionsMutationOptions = mutationOptions({
    mutationFn: (data: Partial<Preferences>) => {
      return fetchMutation<User>({
        method: 'PUT',
        url: USER_ENDPOINT,
        data: {options: data},
      });
    },
    onSuccess: data => {
      handleSubmitSuccess(data);
      addSuccessMessage(t('Preferences saved'));
    },
  });

  const themeMutationOptions = mutationOptions({
    mutationFn: (data: Partial<Preferences>) => {
      return fetchMutation<User>({
        method: 'PUT',
        url: USER_ENDPOINT,
        data: {options: data},
      });
    },
    onSuccess: data => {
      handleSubmitSuccess(data);
      removeBodyTheme();
      addSuccessMessage(t('Preferences saved'));
    },
  });

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Account Details')} />
      <SettingsPageHeader title={t('Account Details')} />
      <FieldGroup title={t('Account Details')}>
        <AutoSaveField
          name="name"
          schema={accountDetailsSchema}
          initialValue={user.name}
          mutationOptions={userMutationOptions}
        >
          {field => (
            <field.Layout.Row label={t('Name')} hintText={t('Your full name')} required>
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="e.g. John Doe"
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        {user.email !== user.username && (
          <AutoSaveField
            name="username"
            schema={accountDetailsSchema}
            initialValue={user.username}
            mutationOptions={userMutationOptions}
          >
            {field => (
              <field.Layout.Row label={t('Username')} required>
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="e.g. name@example.com"
                  disabled={user.isManaged}
                />
              </field.Layout.Row>
            )}
          </AutoSaveField>
        )}

        <AutoSaveField
          name="id"
          schema={accountDetailsSchema}
          initialValue={user.id}
          mutationOptions={userMutationOptions}
        >
          {field => (
            <field.Layout.Row
              label={t('User ID')}
              hintText={t(
                'The unique identifier for your account. It cannot be modified.'
              )}
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                disabled
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>
      </FieldGroup>

      <FieldGroup title={t('Preferences')}>
        <AutoSaveField
          name="theme"
          schema={preferencesSchema}
          initialValue={user.options.theme}
          mutationOptions={themeMutationOptions}
        >
          {field => (
            <field.Layout.Row
              label={t('Theme')}
              hintText={t(
                "Select your theme preference. It can be synced to your system's theme, always light mode, or always dark mode."
              )}
            >
              <field.Select
                value={field.state.value}
                onChange={field.handleChange}
                options={THEME_OPTIONS}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="language"
          schema={preferencesSchema}
          initialValue={user.options.language}
          mutationOptions={userOptionsMutationOptions}
        >
          {field => (
            <field.Layout.Row label={t('Language')}>
              <field.Select
                value={field.state.value}
                onChange={field.handleChange}
                options={LANGUAGE_OPTIONS}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="timezone"
          schema={preferencesSchema}
          initialValue={user.options.timezone}
          mutationOptions={userOptionsMutationOptions}
        >
          {field => (
            <field.Layout.Row label={t('Timezone')}>
              <field.Select
                value={field.state.value}
                onChange={field.handleChange}
                options={timezoneOptions}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="clock24Hours"
          schema={preferencesSchema}
          initialValue={user.options.clock24Hours}
          mutationOptions={userOptionsMutationOptions}
        >
          {field => (
            <field.Layout.Row label={t('Use a 24-hour clock')}>
              <field.Switch checked={field.state.value} onChange={field.handleChange} />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="stacktraceOrder"
          schema={preferencesSchema}
          initialValue={String(user.options.stacktraceOrder)}
          mutationOptions={userOptionsMutationOptions}
        >
          {field => (
            <field.Layout.Row
              label={t('Stack Trace Order')}
              hintText={t('Choose the default ordering of frames in stack traces')}
            >
              <field.Select
                value={field.state.value}
                onChange={field.handleChange}
                options={STACKTRACE_ORDER_OPTIONS}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="defaultIssueEvent"
          schema={preferencesSchema}
          initialValue={user.options.defaultIssueEvent}
          mutationOptions={userOptionsMutationOptions}
        >
          {field => (
            <field.Layout.Row
              label={t('Default Issue Event')}
              hintText={t('Choose what event gets displayed by default')}
            >
              <field.Select
                value={field.state.value}
                onChange={field.handleChange}
                options={DEFAULT_ISSUE_EVENT_OPTIONS}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>
      </FieldGroup>

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
