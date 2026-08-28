import {useMutation, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {API_ACCESS_SCOPES} from 'sentry/constants/apiAccessScopes';
import {t} from 'sentry/locale';
import type {Organization, Team} from 'sentry/types/organization';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';

import {
  type ServiceAccount,
  type ServiceAccountTokenWithSecret,
  type ServiceAccountWithSecret,
  serviceAccountsQueryOptions,
  serviceAccountsUrl,
  serviceAccountTokensUrl,
  serviceAccountUrl,
} from './api';

const scopeOptions = API_ACCESS_SCOPES.map(scope => ({label: scope, value: scope}));

const createSchema = z.object({
  name: z.string().trim().min(1, t('Enter an account name')),
  role: z.string().min(1, t('Select an organization role')),
  scopes: z.array(z.string()).min(1, t('Select at least one permission')),
  teams: z.array(z.string()),
  tokenName: z.string().trim().min(1, t('Enter a token name')),
});

const editSchema = z.object({
  name: z.string().trim().min(1, t('Enter an account name')),
  role: z.string().min(1, t('Select an organization role')),
  teams: z.array(z.string()),
});

const tokenSchema = z.object({
  name: z.string().trim().min(1, t('Enter a token name')),
  scopes: z.array(z.string()).min(1, t('Select at least one permission')),
});

type AccountFormProps = ModalRenderProps & {
  organization: Organization;
  teams: Team[];
};

type CreateAccountFormProps = AccountFormProps & {
  onCreated: (account: ServiceAccountWithSecret) => void;
};

export function CreateServiceAccountForm({
  Body,
  Footer,
  Header,
  closeModal,
  onCreated,
  organization,
  teams,
}: CreateAccountFormProps) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof createSchema>) =>
      fetchMutation<ServiceAccountWithSecret>({
        url: serviceAccountsUrl(organization.slug),
        method: 'POST',
        data,
      }),
    onSuccess: account => {
      queryClient.invalidateQueries({
        queryKey: serviceAccountsQueryOptions(organization.slug).queryKey,
      });
      addSuccessMessage(t('Created service account'));
      closeModal();
      onCreated(account);
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      name: '',
      role: organization.defaultRole || 'member',
      scopes: ['event:read', 'org:read', 'project:read'],
      teams: [] as string[],
      tokenName: 'Default token',
    },
    validators: {onDynamic: createSchema},
    onSubmit: ({value, formApi}) =>
      mutation.mutateAsync(value).catch(error => {
        if (
          error instanceof RequestError &&
          setFieldErrors(formApi, requestErrorToFieldErrors(error, formApi.state.values))
        ) {
          return;
        }
        addErrorMessage(t('Could not create the service account. Try again.'));
      }),
  });

  const roleOptions = organization.orgRoleList
    .filter(role => !role.isRetired)
    .map(role => ({label: role.name, value: role.id}));
  const teamOptions = teams.map(team => ({label: `#${team.slug}`, value: team.slug}));

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h2" size="lg">
          {t('Create Service Account')}
        </Heading>
      </Header>
      <Body>
        <Stack gap="xl">
          <Text variant="muted">
            {t(
              'Assign access through an organization role, teams, and token permissions.'
            )}
          </Text>
          <form.AppField name="name">
            {field => (
              <field.Layout.Stack label={t('Name')} required>
                <field.Input
                  autoFocus
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="role">
            {field => (
              <field.Layout.Stack label={t('Organization role')} required>
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={roleOptions}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="teams">
            {field => (
              <field.Layout.Stack
                label={t('Teams')}
                hintText={t('Leave empty to use the organization open-membership rules.')}
              >
                <field.Select
                  multiple
                  clearable
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={teamOptions}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="tokenName">
            {field => (
              <field.Layout.Stack label={t('First token name')} required>
                <field.Input value={field.state.value} onChange={field.handleChange} />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="scopes">
            {field => (
              <field.Layout.Stack
                label={t('Token permissions')}
                hintText={t('The token cannot exceed the account role and team access.')}
                required
              >
                <field.Select
                  multiple
                  clearable
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={scopeOptions}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <form.SubmitButton variant="primary">
            {t('Create Service Account')}
          </form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}

type EditAccountFormProps = AccountFormProps & {
  account: ServiceAccount;
};

export function EditServiceAccountForm({
  account,
  Body,
  Footer,
  Header,
  closeModal,
  organization,
  teams,
}: EditAccountFormProps) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof editSchema>) =>
      fetchMutation<ServiceAccount>({
        url: serviceAccountUrl(organization.slug, account.id),
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: serviceAccountsQueryOptions(organization.slug).queryKey,
      });
      addSuccessMessage(t('Updated service account'));
      closeModal();
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      name: account.name,
      role: account.role,
      teams: account.teams,
    },
    validators: {onDynamic: editSchema},
    onSubmit: ({value, formApi}) =>
      mutation.mutateAsync(value).catch(error => {
        if (
          error instanceof RequestError &&
          setFieldErrors(formApi, requestErrorToFieldErrors(error, formApi.state.values))
        ) {
          return;
        }
        addErrorMessage(t('Could not update the service account. Try again.'));
      }),
  });

  const roleOptions = organization.orgRoleList
    .filter(role => !role.isRetired)
    .map(role => ({label: role.name, value: role.id}));
  const teamOptions = teams.map(team => ({label: `#${team.slug}`, value: team.slug}));

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h2" size="lg">
          {t('Edit Service Account')}
        </Heading>
      </Header>
      <Body>
        <Stack gap="xl">
          <form.AppField name="name">
            {field => (
              <field.Layout.Stack label={t('Name')} required>
                <field.Input value={field.state.value} onChange={field.handleChange} />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="role">
            {field => (
              <field.Layout.Stack label={t('Organization role')} required>
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={roleOptions}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="teams">
            {field => (
              <field.Layout.Stack label={t('Teams')}>
                <field.Select
                  multiple
                  clearable
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={teamOptions}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <form.SubmitButton variant="primary">{t('Save Changes')}</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}

type CreateTokenFormProps = ModalRenderProps & {
  account: ServiceAccount;
  onCreated: (token: ServiceAccountTokenWithSecret) => void;
  organization: Organization;
};

export function CreateServiceAccountTokenForm({
  account,
  Body,
  Footer,
  Header,
  closeModal,
  onCreated,
  organization,
}: CreateTokenFormProps) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof tokenSchema>) =>
      fetchMutation<ServiceAccountTokenWithSecret>({
        url: serviceAccountTokensUrl(organization.slug, account.id),
        method: 'POST',
        data,
      }),
    onSuccess: token => {
      queryClient.invalidateQueries({
        queryKey: serviceAccountsQueryOptions(organization.slug).queryKey,
      });
      addSuccessMessage(t('Created service account token'));
      closeModal();
      onCreated(token);
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      name: '',
      scopes: ['event:read', 'org:read', 'project:read'],
    },
    validators: {onDynamic: tokenSchema},
    onSubmit: ({value}) =>
      mutation.mutateAsync(value).catch(() => {
        addErrorMessage(t('Could not create the token. Try again.'));
      }),
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h2" size="lg">
          {t('Create Token')}
        </Heading>
      </Header>
      <Body>
        <Stack gap="xl">
          <Text variant="muted">{account.name}</Text>
          <form.AppField name="name">
            {field => (
              <field.Layout.Stack label={t('Name')} required>
                <field.Input
                  autoFocus
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="scopes">
            {field => (
              <field.Layout.Stack label={t('Permissions')} required>
                <field.Select
                  multiple
                  clearable
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={scopeOptions}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <form.SubmitButton variant="primary">{t('Create Token')}</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}
