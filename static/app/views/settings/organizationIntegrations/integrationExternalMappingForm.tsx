import styled from '@emotion/styled';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {
  AutoSaveField,
  defaultFormOptions,
  setFieldErrors,
  useScrapsForm,
} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';

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
  sentryNameToOption,
} from 'sentry/utils/integrationUtil';
import {fetchMutation, queryOptions, useMutation} from 'sentry/utils/queryClient';
import RequestError from 'sentry/utils/requestError/requestError';
import {capitalize} from 'sentry/utils/string/capitalize';
import useOrganization from 'sentry/utils/useOrganization';

type BaseProps = {
  getBaseFormEndpoint: (mapping?: ExternalActorMappingOrSuggestion) => string;
  integration: Integration;
  type: 'user' | 'team';
  defaultOptions?: Array<{label: React.ReactNode; value: string}>;
  mapping?: ExternalActorMappingOrSuggestion;
  onSubmitError?: () => void;
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
  return teams.map(({id, slug}) => sentryNameToOption({id, name: slug}));
}

function mapMembers(members: Member[]) {
  return members
    .filter(member => member.user)
    .map(({user, email, name}) => {
      const label = email === name ? `${email}` : `${name} - ${email}`;
      return sentryNameToOption({id: user?.id!, name: label});
    });
}

function makeTeamSelectQueryOptions(
  orgSlug: string,
  defaultOptions?: Array<{label: React.ReactNode; value: string}>,
  mapping?: ExternalActorMappingOrSuggestion
) {
  return (debouncedInput: string) =>
    queryOptions({
      ...apiOptions.as<Team[]>()('/organizations/$organizationIdOrSlug/teams/', {
        path: {organizationIdOrSlug: orgSlug},
        ...(debouncedInput ? {query: {query: debouncedInput}} : {}),
        staleTime: 0,
      }),
      select: ({json: teams}) =>
        mergeOptions(mapTeams(teams), defaultOptions, mapping, 'team'),
    });
}

function makeMemberSelectQueryOptions(
  orgSlug: string,
  defaultOptions?: Array<{label: React.ReactNode; value: string}>,
  mapping?: ExternalActorMappingOrSuggestion
) {
  return (debouncedInput: string) =>
    queryOptions({
      ...apiOptions.as<Member[]>()('/organizations/$organizationIdOrSlug/members/', {
        path: {organizationIdOrSlug: orgSlug},
        ...(debouncedInput ? {query: {query: debouncedInput}} : {}),
        staleTime: 0,
      }),
      select: ({json: members}) =>
        mergeOptions(mapMembers(members), defaultOptions, mapping, 'user'),
    });
}

function mergeOptions(
  transformed: ReadonlyArray<{label: React.ReactNode; value: string}>,
  defaultOptions?: ReadonlyArray<{label: React.ReactNode; value: string}>,
  mapping?: ExternalActorMappingOrSuggestion,
  type?: 'user' | 'team'
) {
  const result = [...transformed];

  // Merge with defaultOptions if provided
  if (Array.isArray(defaultOptions)) {
    const seen = new Set(result.map(o => o.value));
    const extras = defaultOptions.filter(o => !seen.has(o.value));
    result.unshift(...extras);
  }

  // Ensure current mapping's entry is present
  if (mapping && type && isExternalActorMapping(mapping) && mapping.sentryName) {
    const mappingId = mapping[`${type}Id`];
    if (mappingId && !result.some(o => o.value === mappingId)) {
      result.unshift({value: mappingId, label: mapping.sentryName});
    }
  }

  return result;
}

function buildMutationData(
  mapping: ExternalActorMappingOrSuggestion | undefined,
  integration: Integration,
  type: 'user' | 'team',
  sentryId: string,
  externalName?: string
): Record<string, unknown> {
  return {
    ...mapping,
    ...(externalName === undefined ? {} : {externalName}),
    provider: integration.provider.key,
    integrationId: integration.id,
    [`${type}Id`]: sentryId,
  };
}

function InlineMappingForm({
  defaultOptions,
  getBaseFormEndpoint,
  integration,
  mapping,
  onSubmitError,
  onSubmitSuccess,
  type,
}: InlineProps) {
  const {slug: orgSlug} = useOrganization();

  const initialValue =
    mapping && isExternalActorMapping(mapping) ? String(mapping[`${type}Id`] ?? '') : '';

  const schema = z.object({sentryId: z.string()});

  return (
    <FormWrapper>
      <AutoSaveField
        name="sentryId"
        schema={schema}
        initialValue={initialValue}
        mutationOptions={{
          mutationFn: ({sentryId}: {sentryId: string}) => {
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
          onError: () => onSubmitError?.(),
        }}
      >
        {field =>
          type === 'team' ? (
            <field.SelectAsync
              value={field.state.value}
              onChange={field.handleChange}
              placeholder={t('Select Sentry Team')}
              defaultOptions={defaultOptions}
              queryOptions={makeTeamSelectQueryOptions(orgSlug, defaultOptions, mapping)}
            />
          ) : (
            <field.SelectAsync
              value={field.state.value}
              onChange={field.handleChange}
              placeholder={t('Select Sentry User')}
              defaultOptions={defaultOptions}
              queryOptions={makeMemberSelectQueryOptions(
                orgSlug,
                defaultOptions,
                mapping
              )}
            />
          )
        }
      </AutoSaveField>
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
  onSubmitError,
  onSubmitSuccess,
  type,
}: ModalProps) {
  const {slug: orgSlug} = useOrganization();
  const selectQueryOptions =
    type === 'team'
      ? makeTeamSelectQueryOptions(orgSlug, defaultOptions, mapping)
      : (makeMemberSelectQueryOptions(
          orgSlug,
          defaultOptions,
          mapping
        ) as unknown as ReturnType<typeof makeTeamSelectQueryOptions>);

  const initialSentryId =
    mapping && isExternalActorMapping(mapping) ? String(mapping[`${type}Id`] ?? '') : '';

  const modalSchema = z.object({
    externalName: z.string().min(1, 'This field is required'),
    sentryId: z.string().min(1, 'This field is required'),
  });

  const mutation = useMutation({
    mutationFn: ({externalName, sentryId}: {externalName: string; sentryId: string}) => {
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
    onError: () => onSubmitError?.(),
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      externalName: mapping?.externalName ?? '',
      sentryId: initialSentryId,
    },
    validators: {onDynamic: modalSchema},
    onSubmit: ({value}) =>
      mutation.mutateAsync(value).catch(error => {
        if (error instanceof RequestError) {
          setFieldErrors(form, error);
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
            {field => (
              <field.Layout.Stack
                label={tct('Sentry [type]', {type: capitalize(type)})}
                required
              >
                <field.SelectAsync
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={t('Select Sentry %s', capitalize(type))}
                  defaultOptions={defaultOptions}
                  queryOptions={selectQueryOptions}
                />
              </field.Layout.Stack>
            )}
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

export default function IntegrationExternalMappingForm(props: Props) {
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
