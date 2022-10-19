import {useCallback} from 'react';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import Form, {FormProps} from 'sentry/components/forms/form';
import {t} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';

type Props = FormProps & {
  apiEndpoint: string;
  apiMethod: string;
  onSubmit?: (data: Record<string, any>) => void;
};

function ApiForm({onSubmit, apiMethod, apiEndpoint, ...otherProps}: Props) {
  const api = useApi();

  const handleSubmit = useCallback(
    (
      data: Record<string, any>,
      onSuccess: (response: Record<string, any>) => void,
      onError: (error: any) => void
    ) => {
      onSubmit?.(data);
      addLoadingMessage(t('Saving changes\u2026'));
      api.request(apiEndpoint, {
        method: apiMethod,
        data,
        success: response => {
          clearIndicators();
          onSuccess(response);
        },
        error: error => {
          clearIndicators();
          onError(error);
        },
      });
    },
    [api, onSubmit, apiMethod, apiEndpoint]
  );

  return <Form onSubmit={handleSubmit} {...otherProps} />;
}

export default ApiForm;
