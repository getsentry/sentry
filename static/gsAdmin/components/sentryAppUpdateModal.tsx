import {useMutation, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormValidators, ScrapsForm, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {sentryAppApiOptions} from 'sentry/actionCreators/sentryApps';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {IntegrationFeature, SentryApp} from 'sentry/types/integrations';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation, useApiQuery} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';

type Props = ModalRenderProps & {
  sentryAppData: any;
};

// See Django reference for PositiveSmallIntegerField
// (https://docs.djangoproject.com/en/3.2/ref/models/fields/#positivesmallintegerfield)
const POPULARITY_MIN = 0;
const POPULARITY_MAX = 32767;

const schema = z.object({
  popularity: z
    .number()
    .min(POPULARITY_MIN)
    .max(POPULARITY_MAX)
    .nullable()
    .refine(value => value !== null, 'Popularity is required'),
  features: z.array(z.number()),
});

export function SentryAppUpdateModal(props: Props) {
  const {sentryAppData, closeModal, Header, Body, Footer} = props;
  const queryClient = useQueryClient();
  const sentryAppQueryOptions = sentryAppApiOptions({
    appSlug: sentryAppData.slug,
  });

  const mutation = useMutation({
    mutationFn: (data: {features: number[]; popularity: number}) =>
      fetchMutation<SentryApp>({
        url: getApiUrl('/sentry-apps/$sentryAppIdOrSlug/', {
          path: {sentryAppIdOrSlug: sentryAppData.slug},
        }),
        method: 'PUT',
        data: {...sentryAppData, ...data},
      }),
    onSuccess: updatedSentryApp => {
      queryClient.setQueryData(sentryAppQueryOptions.queryKey, previous => ({
        headers: previous?.headers ?? {},
        json: updatedSentryApp,
      }));
      closeModal();
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: sentryAppQueryOptions.queryKey,
      });
    },
  });

  const {
    data: featureData,
    isPending,
    isError,
    refetch,
  } = useApiQuery<IntegrationFeature[]>([getApiUrl('/integration-features/')], {
    staleTime: 0,
  });

  const defaultValues: z.input<typeof schema> = {
    popularity: sentryAppData.popularity,
    features:
      sentryAppData.featureData?.map(({featureId}: IntegrationFeature) => featureId) ??
      [],
  };
  const form = useScrapsForm({
    defaultValues,
    validators: defaultFormValidators(schema),
    onSubmit: ({value, createValidationError}) =>
      mutation.mutateAsync(schema.parse(value)).catch(error => {
        if (error instanceof RequestError) {
          const fields = requestErrorToFieldErrors(error, value);
          if (fields) {
            return createValidationError({fields});
          }
        }
        addErrorMessage('Unable to update the Sentry App.');
        return;
      }),
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const options = featureData.map(({featureId, featureGate}) => ({
    value: featureId,
    label: featureGate.replace(/(^integrations-)/, ''),
  }));

  return (
    <ScrapsForm form={form}>
      <Header>
        <Heading as="h2">Update Sentry App</Heading>
      </Header>
      <Body>
        <Stack gap="lg">
          <form.Field name="popularity">
            {field => (
              <field.Layout.Stack
                label="New popularity"
                hintText={`Higher values will be more prominent on the integration directory. Only values between ${POPULARITY_MIN} and ${POPULARITY_MAX} are permitted.`}
                required
              >
                <field.Number
                  value={field.value}
                  onChange={field.handleChange}
                  min={POPULARITY_MIN}
                  max={POPULARITY_MAX}
                  disabled={mutation.isPending}
                />
              </field.Layout.Stack>
            )}
          </form.Field>
          <form.Field name="features">
            {field => (
              <field.Layout.Stack
                label="Features"
                hintText="What features does this integration have?"
                required
              >
                <field.Select
                  multiple
                  value={field.value}
                  onChange={field.handleChange}
                  options={options}
                  disabled={mutation.isPending}
                />
              </field.Layout.Stack>
            )}
          </form.Field>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>Cancel</Button>
          <form.SubmitButton>Save</form.SubmitButton>
        </Flex>
      </Footer>
    </ScrapsForm>
  );
}
