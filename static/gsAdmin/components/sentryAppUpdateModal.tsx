import {Fragment, useState} from 'react';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import NumberField from 'sentry/components/forms/fields/numberField';
import SelectField from 'sentry/components/forms/fields/selectField';
import Form from 'sentry/components/forms/form';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {IntegrationFeature} from 'sentry/types/integrations';
import {useApiQuery, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

const fieldProps = {
  stacked: true,
  inline: false,
  flexibleControlStateSize: true,
} as const;

type Props = ModalRenderProps & {
  onAction: (data: any) => void;
  sentryAppData: any;
};

type SubmitQueryVariables = {
  data: Record<string, any>;
  onSubmitError: (error: any) => void;
  onSubmitSuccess: (response: Record<string, any>) => void;
};

type SubmitQueryResponse = Record<string, any>;

// See Django reference for PositiveSmallIntegerField
// (https://docs.djangoproject.com/en/3.2/ref/models/fields/#positivesmallintegerfield)
const POPULARITY_MIN = 0;
const POPULARITY_MAX = 32767;

function SentryAppUpdateModal(props: Props) {
  const api = useApi({persistInFlight: true});
  const {sentryAppData, closeModal, Header, Body} = props;
  const [popularityError, setPopularityError] = useState(false);

  const onPopularityChange = (value: any) => {
    const popularity = parseInt(value, 10);
    const hasError =
      isNaN(popularity) || popularity < POPULARITY_MIN || popularity > POPULARITY_MAX;

    if (hasError) {
      setPopularityError(true);
    }
  };

  const onSubmitMutation = useMutation<
    SubmitQueryResponse,
    RequestError,
    SubmitQueryVariables
  >({
    mutationFn: ({data}: SubmitQueryVariables) => {
      return api.requestPromise(`/sentry-apps/${sentryAppData.slug}/`, {
        method: 'PUT',
        data,
      });
    },
    onMutate: () => {
      addLoadingMessage('Saving changes\u2026');
    },
    onSuccess: (data: Record<string, any>, {onSubmitSuccess}) => {
      clearIndicators();
      onSubmitSuccess(data);
    },
    onError: (err: RequestError, {onSubmitError}) => {
      clearIndicators();
      onSubmitError(err);
    },
  });

  const {
    data: featureData,
    isPending,
    isError,
    refetch,
  } = useApiQuery<IntegrationFeature[]>([`/integration-features/`], {
    staleTime: 0,
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const getFeatures = (): Array<[number, string]> => {
    if (!featureData) {
      return [];
    }
    return featureData.map(({featureId, featureGate}) => [
      featureId,
      featureGate.replace(/(^integrations-)/, ''),
    ]);
  };

  const getInitialData = () => {
    return {
      ...sentryAppData,
      features: sentryAppData?.featureData?.map(({featureId}: any) => featureId),
    };
  };

  return (
    <Fragment>
      <Header>Update Sentry App</Header>
      <Body>
        <Form
          submitDisabled={popularityError}
          onSubmit={(data, onSubmitSuccess, onSubmitError) =>
            onSubmitMutation.mutate({data, onSubmitSuccess, onSubmitError})
          }
          onSubmitSuccess={() => {
            closeModal();
          }}
          initialData={getInitialData()}
        >
          <NumberField
            {...fieldProps}
            name="popularity"
            label="New popularity"
            help={`Higher values will be more prominent on the integration directory. Only values between ${POPULARITY_MIN} and ${POPULARITY_MAX} are permitted.`}
            onChange={onPopularityChange}
            defaultValue={sentryAppData.popularity}
          />
          <SelectField
            {...fieldProps}
            multiple
            name="features"
            label="Features"
            help="What features does this integration have?"
            choices={getFeatures()}
            required
          />
        </Form>
      </Body>
    </Fragment>
  );
}

export default SentryAppUpdateModal;
