import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {useMutation, useQuery} from '@tanstack/react-query';
import {z} from 'zod';

import sentryPattern from 'sentry-images/pattern/sentry-pattern.png';

import {Alert} from '@sentry/scraps/alert';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import type {
  OptionDefinition,
  OptionFieldMeta,
  OptionValue,
} from 'sentry/views/admin/options';
import {optionsForSection, sections} from 'sentry/views/admin/options';

type InstallWizardProps = {onConfigured: () => void};

export type InstallWizardOptions = Record<
  string,
  {field: OptionFieldMeta; value?: unknown}
>;

type WizardField = {definition: OptionDefinition; name: string; required: boolean};

type WizardSection = {fields: WizardField[]; key: string; heading?: string};

function getWizardSections(options: InstallWizardOptions): WizardSection[] {
  const optionKeys = Object.keys(options);
  const missingKeys = optionKeys.filter(key => !options[key]!.field.isSet);
  // On a fresh install the backend reports every required option as set, so
  // prompt for all of them to have the admin confirm the values.
  const shownKeys = new Set(missingKeys.length > 0 ? missingKeys : optionKeys);

  return sections
    .map(section => ({
      key: section.key,
      heading: section.heading,
      fields: optionsForSection(section)
        .filter(
          definition =>
            shownKeys.has(definition.key) && !options[definition.key]!.field.disabled
        )
        .map(definition => {
          const {required, allowEmpty} = options[definition.key]!.field;
          return {
            definition,
            name: definition.key.replaceAll('.', '_'),
            required: required && !allowEmpty,
          };
        }),
    }))
    .filter(section => section.fields.length > 0);
}

function getInitialValue(
  definition: OptionDefinition,
  option: InstallWizardOptions[string]
): OptionValue | undefined {
  // The admin must explicitly choose beacon.anonymous, so a stored value never
  // preselects it.
  const storedValue = definition.key === 'beacon.anonymous' ? undefined : option.value;
  const value = storedValue ?? definition.defaultValue?.();

  if (definition.type === 'boolean') {
    return Boolean(value);
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  return undefined;
}

function getOptionSchema({definition, required}: WizardField) {
  const requiredMessage = t('Field is required');

  if (definition.key === 'system.url-prefix') {
    return z.url({protocol: /^https?$/, error: t('Enter a valid HTTP or HTTPS URL')});
  }

  switch (definition.type) {
    case 'boolean':
      return z.boolean();
    case 'radio':
      return required ? z.string({error: requiredMessage}) : z.string().optional();
    case 'email': {
      const email = z.email({
        pattern: z.regexes.html5Email,
        error: t('Enter a valid email address'),
      });
      return required ? email : email.or(z.literal('')).optional();
    }
    case 'text':
    default:
      return required
        ? z.string({error: requiredMessage}).min(1, requiredMessage)
        : z.string().optional();
  }
}

function InstallWizardForm({
  options,
  onConfigured,
}: InstallWizardProps & {options: InstallWizardOptions}) {
  const wizardSections = getWizardSections(options);
  const fields = wizardSections.flatMap(section => section.fields);

  const defaultValues: Record<string, OptionValue | undefined> = Object.fromEntries(
    fields.map(({definition, name}) => [
      name,
      getInitialValue(definition, options[definition.key]!),
    ])
  );

  const mutation = useMutation({
    mutationFn: (data: Record<string, OptionValue>) =>
      fetchMutation({
        url: getApiUrl('/internal/options/'),
        method: 'PUT',
        data,
        options: {query: {query: 'is:required'}},
      }),
    onSuccess: onConfigured,
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    onSubmit: async ({value}) => {
      const data: Record<string, OptionValue> = {};
      for (const {definition, name} of fields) {
        const optionValue = value[name];
        if (optionValue !== undefined) {
          data[definition.key] = optionValue;
        }
      }

      try {
        await mutation.mutateAsync(data);
      } catch (error) {
        toast.error(
          getRequestErrorUserMessage(error, t('Unable to save the configuration.'))
        );
      }
    },
  });

  return (
    <form.AppForm form={form}>
      <Stack gap="xl">
        <Text as="p">
          {t('Complete setup by filling out the required configuration.')}
        </Text>

        <Stack>
          {wizardSections.map(section => (
            <form.FieldGroup key={section.key} title={section.heading}>
              {section.fields.map(wizardField => {
                const {definition, name, required} = wizardField;
                return (
                  <form.AppField
                    key={name}
                    name={name}
                    validators={{onDynamic: getOptionSchema(wizardField)}}
                  >
                    {field => {
                      const value = field.state.value;

                      switch (definition.type) {
                        case 'boolean':
                          return (
                            <field.Layout.Row
                              label={definition.label}
                              hintText={definition.help}
                              required={required}
                            >
                              <field.Switch
                                checked={value === true}
                                onChange={field.handleChange}
                              />
                            </field.Layout.Row>
                          );
                        case 'radio':
                          return (
                            <field.Layout.Row
                              label={definition.label}
                              hintText={definition.help}
                              required={required}
                            >
                              <field.RadioGroup
                                value={typeof value === 'string' ? value : ''}
                                onChange={field.handleChange}
                              >
                                {({Item}) => (
                                  <Stack gap="sm">
                                    {definition.choices.map(([choice, choiceLabel]) => (
                                      <Item key={choice} value={choice}>
                                        {choiceLabel}
                                      </Item>
                                    ))}
                                  </Stack>
                                )}
                              </field.RadioGroup>
                            </field.Layout.Row>
                          );
                        case 'email':
                        case 'text':
                        default:
                          return (
                            <field.Layout.Row
                              label={definition.label}
                              hintText={definition.help}
                              required={required}
                            >
                              <field.Input
                                type={definition.type}
                                placeholder={definition.placeholder}
                                value={typeof value === 'string' ? value : ''}
                                onChange={field.handleChange}
                              />
                            </field.Layout.Row>
                          );
                      }
                    }}
                  </form.AppField>
                );
              })}
            </form.FieldGroup>
          ))}

          <Flex justify="end">
            <form.SubmitButton>{t('Continue')}</form.SubmitButton>
          </Flex>
        </Stack>
      </Stack>
    </form.AppForm>
  );
}

export default function InstallWizard({onConfigured}: InstallWizardProps) {
  const {
    data: options,
    isPending,
    isError,
  } = useQuery(
    apiOptions.as<InstallWizardOptions>()('/internal/options/', {
      query: {query: 'is:required'},
      staleTime: 0,
    })
  );

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <Alert.Container>
        <Alert variant="danger">
          {t(
            'We were unable to load the required configuration from the Sentry server. Please take a look at the service logs.'
          )}
        </Alert>
      </Alert.Container>
    );
  }

  const version = ConfigStore.get('version');
  return (
    <SentryDocumentTitle noSuffix title={t('Setup Sentry')}>
      <Flex justify="center" padding="2xl">
        <Pattern />
        <Container
          background="primary"
          radius="md"
          maxWidth="1000px"
          css={theme => css`
            box-shadow: ${theme.shadow.high};
            padding: 40px 40px 20px;
            z-index: ${theme.zIndex.initial};
          `}
        >
          <Grid
            flow="column"
            gap="md"
            justify="between"
            align="baseline"
            paddingBottom="xl"
          >
            <Heading as="h1">{t('Welcome to Sentry')}</Heading>
            <Text size="xl" bold>
              {version.current}
            </Text>
          </Grid>
          <InstallWizardForm options={options} onConfigured={onConfigured} />
        </Container>
      </Flex>
    </SentryDocumentTitle>
  );
}

const fixedStyle = css`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
`;

const Pattern = styled('div')`
  z-index: -1;

  &::before {
    ${fixedStyle}
    content: '';
    background-image: linear-gradient(
      to right,
      ${p => p.theme.tokens.background.transparent.accent.muted} 0%,
      ${p => p.theme.tokens.background.accent.vibrant} 100%
    );
    background-repeat: repeat-y;
  }

  &::after {
    ${fixedStyle}
    content: '';
    background: url(${sentryPattern});
    background-size: 400px;
    opacity: 0.8;
  }
`;
