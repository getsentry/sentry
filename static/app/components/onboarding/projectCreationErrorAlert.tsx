import startCase from 'lodash/startCase';

import {Alert} from 'sentry/components/core/alert';
import {t} from 'sentry/locale';
import type RequestError from 'sentry/utils/requestError/requestError';

type Props = {
  error?: RequestError | null;
};

const keyToErrorText: Record<string, string> = {
  actions: t('Notify via integration'),
  conditions: t('Alert conditions'),
  name: t('Alert name'),
  detail: t('Project details'),
};

export function ProjectCreationErrorAlert({error}: Props) {
  const response = error?.responseJSON;

  if (!response) {
    return null;
  }

  return (
    <Alert.Container>
      <Alert variant="danger" showIcon={false}>
        {Object.keys(response).map(key => (
          <div key={key}>
            <strong>{keyToErrorText?.[key] ?? startCase(key)}</strong>:{' '}
            {(response as any)[key]}
          </div>
        ))}
      </Alert>
    </Alert.Container>
  );
}
