import styled from '@emotion/styled';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {
  AutoSaveForm,
  defaultFormOptions,
  setFieldErrors,
  useScrapsForm,
} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t, tct} from 'sentry/locale';
import type {
  ExternalActorMapping,
  ExternalActorMappingOrSuggestion,
  Integration,
} from 'sentry/types/integrations';
import type {Member, Team} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {
  getExternalActorEndpointDetails,
  isExternalActorMapping,
} from 'sentry/utils/integrationUtil';
import {fetchMutation, queryOptions, useMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {capitalize} from 'sentry/utils/string/capitalize';
import {useOrganization} from 'sentry/utils/useOrganization';

type SentrySelection = {id: string; name: string};

type BaseProps = {
  getBaseFormEndpoint: (mapping?: ExternalActorMappingOrSuggestion) => string;
  integration: Integration;
  type: 'user' | 'team';
  defaultOptions?: Array<{label: React.ReactNode; value: SentrySelection}>;
  mapping?: ExternalActorMappingOrSuggestion;
  onSubmitSuccess?: (data: ExternalActorMapping) => void | Promise<void>;
};

type InlineProps = BaseProps & {
  isInline: true;
};

type ModalProps = BaseProps &
  ModalRenderProps & {
    isInline?: false;
  };

type Props = InlineProps | ModalProps;

function mapTeams(teams: Team[]) {
  return teams.map(({id, slug}) => ({
    value: {id, name: slug},
    label: slug,
    textValue: slug,
  }));
}

function mapMembers(members: Member[]) {
  return members
    .filter(member => member.user)
    .map(({user, email, name}) => {
      const label = email === name ? email : `${name} - ${email}`;
      return {
        value: {id: user?.id!, name: label},
        label,
        textValue: label,
      };
    });
}

function makeTeamSelectQueryOptions(
  orgSlug: string,
  defaultOptions?: Array<{label: React.ReactNode; value: SentrySelection}>,
  mapping?: ExternalActorMappingOrSuggestion
) {
  return (debouncedInput: string) =>
    queryOptions({
      ...apiOptions.as<Team[]>()('/organizations/$organizationIdOrSlug/teams/', {
        path: {organizationIdOrSlug: orgSlug},
        ...(debouncedInput ? {query: {query: debouncedInput}} : {}),
        staleTime: 1000 * 60,
      }),
      select: ({json: teams}) => {
        return mergeOptions(mapTeams(teams), defaultOptions, mapping, 'team');
      },
    });
}

function makeMemberSelectQueryOptions(
  orgSlug: string,
  defaultOptions?: Array<{label: React.ReactNode; value: SentrySelection}>,
  mapping?: ExternalActorMappingOrSuggestion
) {
  return (debouncedInput: string) =>
    queryOptions({
      ...apiOptions.as<Member[]>()('/organizations/$organizationIdOrSlug/members/', {
        path: {organizationIdOrSlug: orgSlug},
        ...(debouncedInput ? {query: {query: debouncedInput}} : {}),
        staleTime: 1000 * 60,
      }),
      select: ({json: members}) =>
        mergeOptions(mapMembers(members), defaultOptions, mapping, 'user'),
    });
}

function mergeOptions(
  transformed: ReadonlyArray<{label: React.ReactNode; value: SentrySelection}>,
  defaultOptions?: ReadonlyArray<{label: React.ReactNode; value: SentrySelection}>,
  mapping?: ExternalActorMappingOrSuggestion,
  type?: 'user' | 'team'
) {
  const result = [...transformed];

  // Merge with defaultOptions if provided
  if (Array.isArray(defaultOptions)) {
    const seen = new Set(result.map(o => o.value.id));
    const extras = defaultOptions.filter(o => !seen.has(o.value.id));
    result.unshift(...extras);
  }

  // Ensure current mapping's entry is present
  if (mapping && type && isExternalActorMapping(mapping) && mapping.sentryName) {
    const mappingId = mapping[`${type}Id`];
    if (mappingId && !result.some(o => o.value.id === mappingId)) {
      result.unshift({
        value: {id: mappingId, name: mapping.sentryName},
        label: mapping.sentryName,
      });
    }
  }

  return result;
}

function buildMutationData(
  mapping: ExternalActorMappingOrSuggestion | undefined,
  integration: Integration,
  type: 'user' | 'team',
  sentrySelection: SentrySelection,
  externalName?: string
): Record<string, unknown> {
  return {
    ...mapping,
    ...(externalName === undefined ? {} : {externalName}),
    provider: integration.provider.key,
    integrationId: integration.id,
    [`${type}Id`]: sentrySelection.id,
    sentryName: sentrySelection.name,
  };
}

function InlineMappingForm({
  defaultOptions,
  getBaseFormEndpoint,
  integration,
  mapping,
  onSubmitSuccess,
  type,
}: InlineProps) {
  const {slug: orgSlug} = useOrganization();

  const initialValue =
    mapping && isExternalActorMapping(mapping)
      ? {id: String(mapping[`${type}Id`] ?? ''), name: mapping.sentryName ?? ''}
      : null;

  const schema = z.object({
    sentryId: z.any().refine((val): val is SentrySelection => val !== null),
  });

  return (
    <FormWrapper>
      <AutoSaveForm
        name="sentryId"
        schema={schema}
        initialValue={initialValue}
        mutationOptions={{
          mutationFn: ({sentryId}: {sentryId: SentrySelection}) => {
            const fullData = buildMutationData(mapping, integration, type, sentryId);
            const {apiEndpoint, apiMethod} = getExternalActorEndpointDetails(
              getBaseFormEndpoint(fullData as ExternalActorMappingOrSuggestion),
              fullData as ExternalActorMappingOrSuggestion
            );
            return fetchMutation<ExternalActorMapping>({
              url: apiEndpoint,
              method: apiMethod,
              data: fullData,
            });
          },
          onSuccess: data => onSubmitSuccess?.(data),
          onError: () => {
            addErrorMessage(t('Unable to save changes'));
          },
        }}
      >
        {field =>
          type === 'team' ? (
            <field.SelectAsync
              value={field.state.value}
              onChange={field.handleChange}
              isValueEqual={(a, b) => a.id === b.id}
              placeholder={t('Select Sentry Team')}
              queryOptions={makeTeamSelectQueryOptions(orgSlug, defaultOptions, mapping)}
            />
          ) : (
            <field.SelectAsync
              value={field.state.value}
              onChange={field.handleChange}
              isValueEqual={(a, b) => a.id === b.id}
              placeholder={t('Select Sentry User')}
              queryOptions={makeMemberSelectQueryOptions(
                orgSlug,
                defaultOptions,
                mapping
              )}
            />
          )
        }
      </AutoSaveForm>
    </FormWrapper>
  );
}

function ModalMappingForm({
  Body,
  Footer,
  Header,
  closeModal,
  defaultOptions,
  getBaseFormEndpoint,
  integration,
  mapping,
  onSubmitSuccess,
  type,
}: ModalProps) {
  const {slug: orgSlug} = useOrganization();

  const initialSentryId =
    mapping && isExternalActorMapping(mapping)
      ? {id: String(mapping[`${type}Id`] ?? ''), name: mapping.sentryName ?? ''}
      : null;

  const modalSchema = z.object({
    externalName: z.string().min(1, 'This field is required'),
    sentryId: z
      .any()
      .refine((val): val is SentrySelection => val !== null, 'This field is required'),
  });

  const mutation = useMutation({
    mutationFn: ({
      externalName,
      sentryId,
    }: {
      externalName: string;
      sentryId: SentrySelection;
    }) => {
      const fullData = buildMutationData(
        mapping,
        integration,
        type,
        sentryId,
        externalName
      );
      const {apiEndpoint, apiMethod} = getExternalActorEndpointDetails(
        getBaseFormEndpoint(fullData as ExternalActorMappingOrSuggestion),
        fullData as ExternalActorMappingOrSuggestion
      );
      return fetchMutation<ExternalActorMapping>({
        url: apiEndpoint,
        method: apiMethod,
        data: fullData,
      });
    },
    onSuccess: data => {
      onSubmitSuccess?.(data);
      closeModal();
    },
    onError: () => {
      addErrorMessage(t('Unable to save changes'));
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      externalName: mapping?.externalName ?? '',
      sentryId: initialSentryId!,
    },
    validators: {onDynamic: modalSchema},
    onSubmit: ({value, formApi}) =>
      mutation.mutateAsync(value).catch(error => {
        if (error instanceof RequestError) {
          setFieldErrors(formApi, error);
        }
      }),
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        {tct('Configure External [type] Mapping', {type: capitalize(type)})}
      </Header>
      <Body>
        <Stack gap="xl">
          <form.AppField name="externalName">
            {field => (
              <field.Layout.Stack
                label={tct('External [type]', {type: capitalize(type)})}
                required
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={type === 'user' ? t('@username') : t('@org/teamname')}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="sentryId">
            {field =>
              type === 'team' ? (
                <field.Layout.Stack label={t('Sentry Team')} required>
                  <field.SelectAsync
                    value={field.state.value}
                    onChange={field.handleChange}
                    isValueEqual={(a, b) => a.id === b.id}
                    placeholder={t('Select Sentry Team')}
                    queryOptions={makeTeamSelectQueryOptions(
                      orgSlug,
                      defaultOptions,
                      mapping
                    )}
                  />
                </field.Layout.Stack>
              ) : (
                <field.Layout.Stack label={t('Sentry User')} required>
                  <field.SelectAsync
                    value={field.state.value}
                    onChange={field.handleChange}
                    isValueEqual={(a, b) => a.id === b.id}
                    placeholder={t('Select Sentry User')}
                    queryOptions={makeMemberSelectQueryOptions(
                      orgSlug,
                      defaultOptions,
                      mapping
                    )}
                  />
                </field.Layout.Stack>
              )
            }
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <Flex justify="end" gap="md">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <form.SubmitButton>{t('Save Changes')}</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}

export function IntegrationExternalMappingForm(props: Props) {
  if (props.isInline) {
    return <InlineMappingForm {...props} />;
  }
  return <ModalMappingForm {...props} />;
}

// Prevents errors from appearing off the modal
const FormWrapper = styled('div')`
  position: relative;
  width: inherit;
`;
