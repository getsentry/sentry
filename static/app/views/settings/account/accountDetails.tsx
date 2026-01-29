import {Fragment} from 'react';
import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveField, FieldGroup} from '@sentry/scraps/form';
import {Input} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {updateUser} from 'sentry/actionCreators/account';
import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import AvatarChooser from 'sentry/components/avatarChooser';
import type {FormProps} from 'sentry/components/forms/form';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import accountPreferencesFields from 'sentry/data/forms/accountPreferences';
import {t} from 'sentry/locale';
import type {User} from 'sentry/types/user';
import {
  fetchMutation,
  setApiQueryData,
  useApiQuery,
  useQueryClient,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';
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

const accountDetailsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  username: z.string().min(1, 'Username is required'),
});

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

        <Flex gap="sm" align="center" justify="between">
          <Stack width="50%" gap="xs">
            <Text as="label">{t('User ID')}</Text>
            <Text size="sm" variant="muted">
              {t('The unique identifier for your account. It cannot be modified.')}
            </Text>
          </Stack>
          <Container flexGrow={1}>
            <Input value={user.id} disabled />
          </Container>
        </Flex>
      </FieldGroup>
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
