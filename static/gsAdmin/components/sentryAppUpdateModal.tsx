import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {IntegrationFeature} from 'sentry/types/integrations';
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

  const mutation = useMutation({
    mutationFn: (data: {features: number[]; popularity: number}) =>
      fetchMutation({
        url: getApiUrl('/sentry-apps/$sentryAppIdOrSlug/', {
          path: {sentryAppIdOrSlug: sentryAppData.slug},
        }),
        method: 'PUT',
        data: {...sentryAppData, ...data},
      }),
    onSuccess: closeModal,
    onError: error => {
      if (
        error instanceof RequestError &&
        setFieldErrors(form, requestErrorToFieldErrors(error, form.state.values))
      ) {
        return;
      }
      addErrorMessage('Unable to update the Sentry App.');
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
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value}) => mutation.mutateAsync(schema.parse(value)).catch(() => {}),
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
    <form.AppForm form={form}>
      <Header>Update Sentry App</Header>
      <Body>
        <Stack gap="lg">
          <form.AppField name="popularity">
            {field => (
              <field.Layout.Stack
                label="New popularity"
                hintText={`Higher values will be more prominent on the integration directory. Only values between ${POPULARITY_MIN} and ${POPULARITY_MAX} are permitted.`}
                required
              >
                <field.Number
                  value={field.state.value}
                  onChange={field.handleChange}
                  min={POPULARITY_MIN}
                  max={POPULARITY_MAX}
                  disabled={mutation.isPending}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="features">
            {field => (
              <field.Layout.Stack
                label="Features"
                hintText="What features does this integration have?"
                required
              >
                <field.Select
                  multiple
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={options}
                  disabled={mutation.isPending}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>Cancel</Button>
          <form.SubmitButton>Save</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}
