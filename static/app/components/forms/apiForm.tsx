import {useCallback} from 'react';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import {RequestOptions} from 'sentry/api';
import Form, {FormProps} from 'sentry/components/forms/form';
import {t} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';

type Props = FormProps & {
  apiEndpoint: string;
  apiMethod: string;
  hostOverride?: string;
  onSubmit?: (data: Record<string, any>) => any | void;
};

function ApiForm({onSubmit, apiMethod, apiEndpoint, hostOverride, ...otherProps}: Props) {
  const api = useApi();

  const handleSubmit = useCallback(
    (
      data: Record<string, any>,
      onSuccess: (response: Record<string, any>) => void,
      onError: (error: any) => void
    ) => {
      const transformed = onSubmit?.(data);
      addLoadingMessage(t('Saving changes\u2026'));

      const requestOptions: RequestOptions = {
        method: apiMethod,
        data: transformed ?? data,
        success: response => {
          clearIndicators();
          onSuccess(response);
        },
        error: error => {
          clearIndicators();
          onError(error);
        },
      };

      if (hostOverride) {
        requestOptions.host = hostOverride;
      }

      api.request(apiEndpoint, requestOptions);
    },
    [api, onSubmit, apiMethod, apiEndpoint, hostOverride]
  );

  return <Form onSubmit={handleSubmit} {...otherProps} />;
}

export default ApiForm;
