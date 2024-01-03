import {useCallback, useMemo} from 'react';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import {RequestOptions} from 'sentry/api';
import Form, {FormProps} from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import {t} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';

type Props = FormProps & {
  apiEndpoint: string;
  apiMethod: string;
  hostOverride?: string;
  onSubmit?: (data: Record<string, any>) => any | void;
};

function ApiForm({
  onSubmit,
  apiMethod,
  apiEndpoint,
  hostOverride,
  model,
  ...otherProps
}: Props) {
  const api = useApi();
  const formModel = useMemo(() => model ?? new FormModel(), [model]);

  const handleSubmit = useCallback(
    (
      data: Record<string, any>,
      onSuccess: (response: Record<string, any>) => void,
      onError: (error: any) => void
    ) => {
      if (!formModel.validateForm()) {
        return;
      }

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
    [api, onSubmit, apiMethod, apiEndpoint, hostOverride, formModel]
  );

  return <Form onSubmit={handleSubmit} model={formModel} {...otherProps} />;
}

export default ApiForm;
