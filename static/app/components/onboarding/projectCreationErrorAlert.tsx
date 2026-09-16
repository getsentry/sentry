import {Alert} from '@sentry/scraps/alert';

import {getWorkflowEngineResponseErrorMessage} from 'sentry/components/workflowEngine/getWorkflowEngineResponseErrorMessage';
import type {RequestError} from 'sentry/utils/requestError/requestError';

type Props = {
  error?: RequestError | null;
};

export function ProjectCreationErrorAlert({error}: Props) {
  const message = getWorkflowEngineResponseErrorMessage(error?.responseJSON);

  if (!message) {
    return null;
  }

  return (
    <Alert.Container>
      <Alert variant="danger" showIcon={false}>
        {message}
      </Alert>
    </Alert.Container>
  );
}
