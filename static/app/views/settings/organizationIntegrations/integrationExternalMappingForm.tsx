import styled from '@emotion/styled';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {AutoSaveField, defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t, tct} from 'sentry/locale';
import type {
  ExternalActorMappingOrSuggestion,
  Integration,
} from 'sentry/types/integrations';
import apiFetch from 'sentry/utils/api/apiFetch';
import {
  getExternalActorEndpointDetails,
  isExternalActorMapping,
  sentryNameToOption,
} from 'sentry/utils/integrationUtil';
import {
  fetchMutation,
  queryOptions,
  useMutation,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';
import {capitalize} from 'sentry/utils/string/capitalize';

type BaseProps = {
  dataEndpoint: string;
  getBaseFormEndpoint: (mapping?: ExternalActorMappingOrSuggestion) => string;
  integration: Integration;
  sentryNamesMapper: (v: any) => Array<{id: string; name: string}>;
  type: 'user' | 'team';
  defaultOptions?: Array<{label: React.ReactNode; value: string}>;
  mapping?: ExternalActorMappingOrSuggestion;
  onSubmitError?: (error: any) => void;
  onSubmitSuccess?: (data: any) => void;
};

type InlineProps = BaseProps & {
  isInline: true;
};

type ModalProps = BaseProps &
  ModalRenderProps & {
    isInline?: false;
  };

type Props = InlineProps | ModalProps;

function makeSelectQueryOptions({
  dataEndpoint,
  defaultOptions,
  mapping,
  type,
  sentryNamesMapper,
}: Pick<
  BaseProps,
  'dataEndpoint' | 'defaultOptions' | 'mapping' | 'type' | 'sentryNamesMapper'
>) {
  return (_debouncedInput: string) =>
    queryOptions({
      queryKey: [dataEndpoint as any] as ApiQueryKey,
      queryFn: apiFetch<any[]>,
      staleTime: 0,
      select: response => {
        const mapped = sentryNamesMapper(response.json);
        const transformed = (Array.isArray(mapped) ? mapped : []).map(sentryNameToOption);

        // Merge with defaultOptions if provided
        if (Array.isArray(defaultOptions)) {
          const seen = new Set(transformed.map(o => o.value));
          const extras = defaultOptions.filter(o => !seen.has(o.value));
          transformed.unshift(...extras);
        }

        // Ensure current mapping's entry is present
        if (mapping && isExternalActorMapping(mapping) && mapping.sentryName) {
          const mappingId = (mapping as any)[`${type}Id`];
          if (mappingId && !transformed.some(o => o.value === mappingId)) {
            transformed.unshift({value: mappingId, label: mapping.sentryName});
          }
        }

        return transformed;
      },
    });
}

function buildMutationData(
  mapping: ExternalActorMappingOrSuggestion | undefined,
  integration: Integration,
  type: 'user' | 'team',
  sentryId: string,
  externalName?: string
): Record<string, any> {
  return {
    ...mapping,
    ...(externalName === undefined ? {} : {externalName}),
    provider: integration.provider.key,
    integrationId: integration.id,
    [`${type}Id`]: sentryId,
  };
}

function InlineMappingForm({
  dataEndpoint,
  defaultOptions,
  getBaseFormEndpoint,
  integration,
  mapping,
  onSubmitError,
  onSubmitSuccess,
  sentryNamesMapper,
  type,
}: InlineProps) {
  const selectQueryOptions = makeSelectQueryOptions({
    dataEndpoint,
    defaultOptions,
    mapping,
    type,
    sentryNamesMapper,
  });

  const fieldName = `${type}Id` as const;
  const initialValue =
    mapping && isExternalActorMapping(mapping)
      ? String((mapping as any)[fieldName] ?? '')
      : '';

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
            return fetchMutation({url: apiEndpoint, method: apiMethod, data: fullData});
          },
          onSuccess: (resp: any) => onSubmitSuccess?.(resp),
          onError: (err: any) => onSubmitError?.(err),
        }}
      >
        {field => (
          <field.SelectAsync
            value={field.state.value}
            onChange={field.handleChange}
            placeholder={t('Select Sentry %s', capitalize(type))}
            queryOptions={selectQueryOptions}
          />
        )}
      </AutoSaveField>
    </FormWrapper>
  );
}

function ModalMappingForm({
  Body,
  Footer,
  Header,
  closeModal,
  dataEndpoint,
  defaultOptions,
  getBaseFormEndpoint,
  integration,
  mapping,
  onSubmitError,
  onSubmitSuccess,
  sentryNamesMapper,
  type,
}: ModalProps) {
  const selectQueryOptions = makeSelectQueryOptions({
    dataEndpoint,
    defaultOptions,
    mapping,
    type,
    sentryNamesMapper,
  });

  const fieldName = `${type}Id` as const;
  const initialSentryId =
    mapping && isExternalActorMapping(mapping)
      ? String((mapping as any)[fieldName] ?? '')
      : '';

  const modalSchema = z.object({
    externalName: z.string().min(1),
    sentryId: z.string().min(1),
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
      return fetchMutation({url: apiEndpoint, method: apiMethod, data: fullData});
    },
    onSuccess: (resp: any) => {
      onSubmitSuccess?.(resp);
      closeModal();
    },
    onError: (err: any) => onSubmitError?.(err),
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      externalName: mapping?.externalName ?? '',
      sentryId: initialSentryId,
    },
    validators: {onDynamic: modalSchema},
    onSubmit: ({value}) => mutation.mutateAsync(value).catch(() => {}),
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
