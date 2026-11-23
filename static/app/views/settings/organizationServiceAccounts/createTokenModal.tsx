import {useMemo} from 'react';
import moment from 'moment-timezone';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {DateTime} from '@sentry/scraps/dateTime';
import {
  defaultFormOptions,
  setFieldErrors,
  useScrapsForm,
  useStore,
} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import type {ModalRenderProps} from '@sentry/scraps/modal';
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {t, tct} from 'sentry/locale';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';

import {useCreateServiceAccountToken} from './serviceAccountApi';
import {getDetailFieldErrors, MAX_NAME_LENGTH} from './serviceAccountForm';
import type {NewServiceAccountToken, ServiceAccount} from './types';

const EXPIRATION = z.enum(['7', '30', '90', '365', 'never']);

type Expiration = z.infer<typeof EXPIRATION>;

const EXPIRATION_LABELS: Record<Expiration, string> = {
  '7': t('7 days'),
  '30': t('30 days'),
  '90': t('90 days'),
  '365': t('1 year'),
  never: t('No expiration'),
};

const EXPIRATION_OPTIONS = EXPIRATION.options.map(value => ({
  value,
  label: EXPIRATION_LABELS[value],
}));

const DEFAULT_EXPIRATION: Expiration = '30';

const API_FIELDS = ['name', 'scopes', 'expiresAt'] as const;

const schema = z.object({
  name: z.string().trim().min(1, t('Name is required')).max(MAX_NAME_LENGTH),
  scopeMode: z.enum(['all', 'choose']),
  scopes: z.array(z.string()),
  expiration: EXPIRATION,
});

type FormValues = z.infer<typeof schema>;

/** Puts each API error on the form field that shows it. */
function getFormErrors(error: RequestError, scopeMode: FormValues['scopeMode']) {
  const {name, scopes, expiresAt} = getDetailFieldErrors(error, API_FIELDS);
  return {
    ...(name && {name}),
    // The scopes field is hidden while every available scope is picked.
    ...(scopes && (scopeMode === 'all' ? {scopeMode: scopes} : {scopes})),
    ...(expiresAt && {expiration: expiresAt}),
  };
}

function getExpiryDate(expiration: Expiration) {
  return expiration === 'never'
    ? null
    : moment().add(Number(expiration), 'days').toDate();
}

interface Props extends ModalRenderProps {
  account: ServiceAccount;
  onCreated: (token: NewServiceAccountToken) => void;
}

export function CreateTokenModal({
  Header,
  Body,
  Footer,
  closeModal,
  account,
  onCreated,
}: Props) {
  const organization = useOrganization();
  const createToken = useCreateServiceAccountToken(organization, account.id, token => {
    closeModal();
    onCreated(token);
  });
  // The API rejects scopes the caller doesn't hold, even when the account has them.
  const grantableScopes = useMemo(() => {
    const callerScopes = new Set<string>(organization.access);
    return account.scopes.filter(scope => callerScopes.has(scope));
  }, [account.scopes, organization.access]);

  const defaultValues = useMemo<FormValues>(
    () => ({
      name: '',
      scopeMode: 'all',
      scopes: grantableScopes,
      expiration: DEFAULT_EXPIRATION,
    }),
    [grantableScopes]
  );

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: async ({value, formApi}) => {
      try {
        await createToken.mutateAsync({
          name: value.name.trim(),
          scopes: value.scopeMode === 'all' ? grantableScopes : value.scopes,
          expiresAt: getExpiryDate(value.expiration)?.toISOString() ?? null,
        });
      } catch (error) {
        toast.error(getRequestErrorUserMessage(error, t('Unable to create token.')));
        if (error instanceof RequestError) {
          setFieldErrors(formApi, getFormErrors(error, value.scopeMode));
        }
      }
    },
  });

  const values = useStore(form.store, state => state.values);
  const expiryDate = getExpiryDate(values.expiration);
  const noScopesPicked =
    values.scopeMode === 'all'
      ? grantableScopes.length === 0
      : values.scopes.length === 0;

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h4">{t('Create Token for %s', account.name)}</Heading>
      </Header>
      <Body>
        <Stack gap="xl">
          <form.AppField name="name">
            {field => (
              <field.Layout.Stack
                label={t('Name')}
                hintText={t('Where you’ll use it, e.g. ‘GitHub Actions: prod’.')}
                required
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  autoFocus
                />
              </field.Layout.Stack>
            )}
          </form.AppField>

          <form.AppField name="scopeMode">
            {field => (
              <field.RadioGroup value={field.state.value} onChange={field.handleChange}>
                {({Item}) => (
                  <field.Layout.Stack
                    label={t('Scopes')}
                    hintText={t(
                      'A token can’t do more than its service account, or more than you can.'
                    )}
                  >
                    <Stack gap="md">
                      <Item value="all">
                        {t('All available scopes (%s)', grantableScopes.length)}
                      </Item>
                      <Item value="choose">{t('Choose scopes')}</Item>
                    </Stack>
                  </field.Layout.Stack>
                )}
              </field.RadioGroup>
            )}
          </form.AppField>

          {values.scopeMode === 'choose' && (
            <form.AppField name="scopes">
              {field => (
                <field.CheckboxGroup
                  value={field.state.value}
                  onChange={field.handleChange}
                >
                  {({Item}) => (
                    <field.Layout.Stack label={t('Token scopes')} variant="compact">
                      <Flex wrap="wrap" gap="sm lg">
                        {grantableScopes.map(scope => (
                          <Item key={scope} value={scope}>
                            <Text monospace>{scope}</Text>
                          </Item>
                        ))}
                      </Flex>
                    </field.Layout.Stack>
                  )}
                </field.CheckboxGroup>
              )}
            </form.AppField>
          )}

          <form.AppField name="expiration">
            {field => (
              <field.Layout.Stack
                label={t('Expiration')}
                hintText={
                  expiryDate
                    ? tct('Expires [date].', {
                        date: <DateTime date={expiryDate} mode="date" year="always" />,
                      })
                    : undefined
                }
              >
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={EXPIRATION_OPTIONS}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>

          {values.expiration === 'never' && (
            <Alert.Container>
              <Alert variant="warning">
                {t(
                  'A token that never expires is riskier if it leaks. Use this only for systems that can’t rotate tokens.'
                )}
              </Alert>
            </Alert.Container>
          )}
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <form.SubmitButton
            disabled={noScopesPicked}
            tooltipProps={
              noScopesPicked ? {title: t('Pick at least one scope.')} : undefined
            }
          >
            {t('Create Token')}
          </form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}
