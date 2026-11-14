import moment from 'moment-timezone';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm, useStore} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import type {ModalRenderProps} from '@sentry/scraps/modal';
import {Heading, Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

import {useCreateServiceAccountToken} from './mockServiceAccountApi';
import {getScopeResource, SCOPE_CATEGORIES} from './serviceAccountData';
import type {NewServiceAccountToken, ServiceAccount} from './types';

const EXPIRATION_OPTIONS = [
  {value: '7', label: t('7 days')},
  {value: '30', label: t('30 days')},
  {value: '90', label: t('90 days')},
  {value: '365', label: t('1 year')},
  {value: 'never', label: t('No expiration')},
] as const;

type Expiration = (typeof EXPIRATION_OPTIONS)[number]['value'];

const schema = z.object({
  name: z.string().trim().min(1, t('Name is required')),
  scopeMode: z.enum(['all', 'choose']),
  scopes: z.array(z.string()),
  expiration: z.enum(['7', '30', '90', '365', 'never']),
});

function getExpiryDate(expiration: Expiration) {
  return expiration === 'never' ? null : moment().add(Number(expiration), 'days');
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
  const user = useUser();
  const createToken = useCreateServiceAccountToken({
    accountId: account.id,
    createdBy: user.name,
    orgSlug: organization.slug,
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      name: '',
      scopeMode: 'all' as 'all' | 'choose',
      scopes: account.scopes,
      expiration: '90' as Expiration,
    },
    validators: {onDynamic: schema},
    onSubmit: ({value}) =>
      createToken
        .mutateAsync({
          name: value.name.trim(),
          scopes: value.scopeMode === 'all' ? account.scopes : value.scopes,
          dateExpires: getExpiryDate(value.expiration)?.toISOString() ?? null,
        })
        .then(token => {
          closeModal();
          onCreated(token);
        })
        .catch(() => {}),
  });

  const values = useStore(form.store, state => state.values);
  const expiryDate = getExpiryDate(values.expiration);
  const noScopesPicked = values.scopeMode === 'choose' && values.scopes.length === 0;

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
                hintText={t('Where it\'s used, e.g. "GitHub Actions: prod".')}
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
                    hintText={t('A token can never do more than its service account.')}
                  >
                    <Stack gap="md">
                      <Item value="all">
                        {t("All of this account's scopes (%s)", account.scopes.length)}
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
                      <Stack gap="lg">
                        {SCOPE_CATEGORIES.map(category => {
                          const categoryScopes = account.scopes.filter(
                            scope => getScopeResource(scope)?.category === category.id
                          );
                          if (categoryScopes.length === 0) {
                            return null;
                          }
                          return (
                            <Stack key={category.id} gap="sm">
                              <Text bold uppercase size="sm">
                                {category.label}
                              </Text>
                              <Flex wrap="wrap" gap="sm lg">
                                {categoryScopes.map(scope => (
                                  <Item key={scope} value={scope}>
                                    <Text monospace>{scope}</Text>
                                  </Item>
                                ))}
                              </Flex>
                            </Stack>
                          );
                        })}
                      </Stack>
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
                    ? tct('Expires [date]', {
                        date: <DateTime date={expiryDate} dateOnly year />,
                      })
                    : undefined
                }
              >
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={[...EXPIRATION_OPTIONS]}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>

          {values.expiration === 'never' && (
            <Alert.Container>
              <Alert variant="warning">
                {t(
                  "Tokens that never expire are riskier if leaked. Use this only for systems that can't rotate."
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
